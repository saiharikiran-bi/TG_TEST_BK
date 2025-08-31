-- Simple sequence fix for users table
-- Run this in your PostgreSQL database

-- Reset the sequence to the next available ID
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM users));

-- Verify the fix
SELECT currval('users_id_seq') as current_sequence_value;
