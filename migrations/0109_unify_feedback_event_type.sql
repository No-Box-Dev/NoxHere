-- Historical event rows used the former Feedback product namespace.
UPDATE events
SET type = 'feedback:issue_created'
WHERE type = 'spot:issue_created';
