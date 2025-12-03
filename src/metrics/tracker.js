class MetricsTracker {
  constructor(db) {
    this.db = db;
    this.currentSession = null;
    this.currentClaim = null;
    this.tabStartTime = null;
    this.currentTab = null;
    this.initSession();
  }

  initSession() {
    const result = this.db.execute(
      'INSERT INTO sessions (user_id) VALUES (?)',
      ['default_user']
    );
    this.currentSession = result.lastInsertRowid;
  }

  startClaim(claimId, claimType) {
    if (this.currentClaim) {
      this.endClaim();
    }

    const result = this.db.execute(
      'INSERT INTO claims (session_id, claim_id, claim_type) VALUES (?, ?, ?)',
      [this.currentSession, claimId, claimType]
    );
    this.currentClaim = result.lastInsertRowid;
    
    this.trackEvent({
      type: 'claim_started',
      claimId,
      claimType
    });
  }

  endClaim() {
    if (!this.currentClaim) return;

    if (this.currentTab) {
      this.endTab();
    }

    const claim = this.db.queryOne(
      'SELECT start_time FROM claims WHERE id = ?',
      [this.currentClaim]
    );

    const duration = Math.floor((Date.now() - new Date(claim.start_time).getTime()) / 1000);

    this.db.execute(
      'UPDATE claims SET end_time = CURRENT_TIMESTAMP, duration_seconds = ? WHERE id = ?',
      [duration, this.currentClaim]
    );

    this.trackEvent({
      type: 'claim_completed',
      duration
    });

    this.currentClaim = null;
  }

  startTab(tabName) {
    if (this.currentTab) {
      this.endTab();
    }

    this.currentTab = tabName;
    this.tabStartTime = Date.now();

    this.trackEvent({
      type: 'tab_opened',
      tabName
    });
  }

  endTab() {
    if (!this.currentTab || !this.tabStartTime) return;

    const timeSpent = Math.floor((Date.now() - this.tabStartTime) / 1000);

    this.db.execute(
      'INSERT INTO tab_interactions (claim_id, tab_name, time_spent_seconds) VALUES (?, ?, ?)',
      [this.currentClaim, this.currentTab, timeSpent]
    );

    this.currentTab = null;
    this.tabStartTime = null;
  }

  trackValidation(fieldName, validationType, isValid, errorMessage = null) {
    if (!this.currentClaim) return;

    this.db.execute(
      'INSERT INTO validations (claim_id, field_name, validation_type, is_valid, error_message) VALUES (?, ?, ?, ?, ?)',
      [this.currentClaim, fieldName, validationType, isValid ? 1 : 0, errorMessage]
    );
  }

  trackEvent(eventData) {
    this.db.execute(
      'INSERT INTO events (session_id, claim_id, event_type, event_data) VALUES (?, ?, ?, ?)',
      [this.currentSession, this.currentClaim, eventData.type, JSON.stringify(eventData)]
    );
  }

  trackNavigation(url) {
    this.trackEvent({
      type: 'navigation',
      url
    });
  }

  getMetrics(filters = {}) {
    const { startDate, endDate, claimType } = filters;
    
    let sql = `
      SELECT 
        c.claim_type,
        COUNT(c.id) as total_claims,
        AVG(c.duration_seconds) as avg_duration,
        MIN(c.duration_seconds) as min_duration,
        MAX(c.duration_seconds) as max_duration
      FROM claims c
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      sql += ' AND c.start_time >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      sql += ' AND c.start_time <= ?';
      params.push(endDate);
    }
    
    if (claimType) {
      sql += ' AND c.claim_type = ?';
      params.push(claimType);
    }
    
    sql += ' GROUP BY c.claim_type';
    
    return this.db.query(sql, params);
  }

  getSessionSummary() {
    return this.db.queryOne(
      `SELECT 
        COUNT(c.id) as claims_processed,
        AVG(c.duration_seconds) as avg_claim_duration,
        SUM(c.duration_seconds) as total_time_seconds
      FROM claims c
      WHERE c.session_id = ?`,
      [this.currentSession]
    );
  }
}

module.exports = MetricsTracker;
