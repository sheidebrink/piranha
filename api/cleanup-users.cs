using Microsoft.Data.Sqlite;

namespace PiranhaAPI;

public class UserCleanup
{
    public static void CleanupDuplicateUsers()
    {
        var connectionString = "Data Source=piranha_metrics.db";
        using var connection = new SqliteConnection(connectionString);
        connection.Open();

        Console.WriteLine("=== CHECKING FOR DUPLICATE USERS ===");
        
        // Find duplicate usernames (case-insensitive)
        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT LOWER(username) as normalized_username, COUNT(*) as count, 
                   GROUP_CONCAT(id) as ids, GROUP_CONCAT(username) as usernames
            FROM users 
            GROUP BY LOWER(username) 
            HAVING COUNT(*) > 1";
        
        using var reader = command.ExecuteReader();
        var duplicates = new List<(string normalizedUsername, string ids, string usernames)>();
        
        while (reader.Read())
        {
            var normalizedUsername = reader["normalized_username"].ToString();
            var ids = reader["ids"].ToString();
            var usernames = reader["usernames"].ToString();
            duplicates.Add((normalizedUsername, ids, usernames));
            Console.WriteLine($"Duplicate found: {normalizedUsername} - IDs: {ids} - Usernames: {usernames}");
        }
        reader.Close();

        // Clean up duplicates - keep the first one, delete the rest
        foreach (var (normalizedUsername, ids, usernames) in duplicates)
        {
            var idList = ids.Split(',');
            var usernameList = usernames.Split(',');
            
            Console.WriteLine($"Cleaning up duplicates for {normalizedUsername}:");
            Console.WriteLine($"  Keeping: ID {idList[0]} ({usernameList[0]})");
            
            // Update the kept user to have normalized username
            var updateCmd = connection.CreateCommand();
            updateCmd.CommandText = "UPDATE users SET username = ? WHERE id = ?";
            updateCmd.Parameters.AddWithValue("@username", normalizedUsername);
            updateCmd.Parameters.AddWithValue("@id", idList[0]);
            updateCmd.ExecuteNonQuery();
            
            // Delete the duplicates
            for (int i = 1; i < idList.Length; i++)
            {
                Console.WriteLine($"  Deleting: ID {idList[i]} ({usernameList[i]})");
                var deleteCmd = connection.CreateCommand();
                deleteCmd.CommandText = "DELETE FROM users WHERE id = ?";
                deleteCmd.Parameters.AddWithValue("@id", idList[i]);
                deleteCmd.ExecuteNonQuery();
            }
        }

        Console.WriteLine("\n=== FINAL USERS TABLE ===");
        command.CommandText = "SELECT * FROM users ORDER BY username";
        using var finalReader = command.ExecuteReader();

        while (finalReader.Read())
        {
            Console.WriteLine($"ID: {finalReader["id"]}, Username: {finalReader["username"]}, Email: {finalReader["email"]}");
        }
        
        Console.WriteLine("Cleanup complete!");
    }
}