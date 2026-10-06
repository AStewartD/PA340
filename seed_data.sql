-- Seed script to help satisfy the joined-row requirement.
-- Compatible with older MySQL versions (including 5.7) that do not support recursive CTE.
-- It inserts 120 sample documents and links each one to an existing tag.

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_documents $$
CREATE PROCEDURE seed_documents()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE new_document_id INT;
    DECLARE selected_tag_id INT;

    SELECT id INTO selected_tag_id
    FROM tags
    ORDER BY id ASC
    LIMIT 1;

    IF selected_tag_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No tags found. Insert at least one tag first.';
    END IF;

    START TRANSACTION;

    WHILE i <= 120 DO
        INSERT INTO documents (
            title,
            content,
            doc_type,
            category,
            page_count,
            created_at
        ) VALUES (
            CONCAT('Sample Note ', i),
            CONCAT('Generated sample content #', i),
            CASE
                WHEN MOD(i, 3) = 0 THEN 'article'
                WHEN MOD(i, 3) = 1 THEN 'story'
                ELSE 'note'
            END,
            CASE
                WHEN MOD(i, 4) = 0 THEN 'school'
                WHEN MOD(i, 4) = 1 THEN 'work'
                WHEN MOD(i, 4) = 2 THEN 'personal'
                ELSE 'research'
            END,
            MOD(i, 12) + 1,
            DATE_SUB(CURDATE(), INTERVAL MOD(i, 60) DAY)
        );

        SET new_document_id = LAST_INSERT_ID();

        INSERT INTO documents_to_tags (documents_id, tags_id)
        VALUES (new_document_id, selected_tag_id);

        SET i = i + 1;
    END WHILE;

    COMMIT;
END $$

DELIMITER ;

CALL seed_documents();
DROP PROCEDURE seed_documents;

-- Verify joined row count.
SELECT COUNT(*) AS joined_rows
FROM documents d
INNER JOIN documents_to_tags dt ON dt.documents_id = d.id
INNER JOIN tags t ON t.id = dt.tags_id;
