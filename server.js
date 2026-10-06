// libraries
const express = require('express');
const mysql = require('mysql');

const app = express();
const port = process.env.PORT || 3000;

const connection = mysql.createConnection({
    host: 'student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com',
    user: 'ALLIESTEWART',
    password: 'KOCV4Wr0O4bzZRvrRiMaYQGNHIRuRO6YrpP',
    database: 'ALLIESTEWART',
    port: 3306
});

let databaseReady = false;

connection.on('error', (error) => {
    databaseReady = false;
    console.error('MySQL connection error:', error.code);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection lost.');
    }
    if (error.code === 'ER_CON_COUNT_ERROR') {
        console.error('Database has too many connections.');
    }
    if (error.code === 'ER_AUTHENTICATION_PLUGIN_ERROR') {
        console.error('Database authentication failed.');
    }
});

app.use(express.json());

app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.sendStatus(204);
    }

    // Check if database connection is ready for data endpoints
    if (request.path.startsWith('/tags') || request.path.startsWith('/categories') || request.path.startsWith('/documents')) {
        if (!databaseReady) {
            return response.status(503).json({
                message: 'Database connection not available. Check the remote database connection and restart the server.'
            });
        }
    }

    next();
});

const ensureForeignKeysForJunctionTable = () => {
    if (!databaseReady) {
        console.log('Database connection not yet established. Skipping foreign key check.');
        return;
    }

    const checkSql = `
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'documents_to_tags'
          AND (COLUMN_NAME = 'documents_id' OR COLUMN_NAME = 'tags_id')
        LIMIT 1
    `;

    connection.query(checkSql, (checkError, checkResult) => {
        if (checkError) {
            console.log('Foreign key check error:', checkError.code);
            return;
        }

        if (checkResult.length > 0) {
            console.log('Foreign key constraints already exist.');
            return;
        }

        const fkSql = `
            ALTER TABLE documents_to_tags
            ADD CONSTRAINT fk_documents_to_tags_documents FOREIGN KEY (documents_id) REFERENCES documents(id) ON DELETE CASCADE,
            ADD CONSTRAINT fk_documents_to_tags_tags FOREIGN KEY (tags_id) REFERENCES tags(id) ON DELETE CASCADE
        `;

        connection.query(fkSql, (fkError) => {
            if (fkError) {
                console.log('Could not add foreign keys:', fkError.code);
            } else {
                console.log('Foreign key constraints added successfully.');
            }
        });
    });
};

const normalizeTagIds = (rawTags) => {
    const values = Array.isArray(rawTags) ? rawTags : [rawTags];

    return values
        .map((value) => parseInt(value, 10))
        .filter((tagId) => Number.isInteger(tagId) && tagId > 0);
};

const validateInsertPayload = (payload) => {
    const errors = {};

    const title = (payload.title || '').trim();
    const docType = (payload.docType || '').trim();
    const category = (payload.category || '').trim();
    const tagIds = normalizeTagIds(payload.tags);
    const pageCount = parseInt(payload.pageCount, 10);
    const date = payload.date;

    if (!title || title.length < 3 || title.length > 100) {
        errors.title = 'Title is required and must be 3-100 characters.';
    }
    if (!docType || docType.length < 2 || docType.length > 50) {
        errors.docType = 'Doc type is required and must be 2-50 characters.';
    }
    if (!category || category.length < 2 || category.length > 50) {
        errors.category = 'Category is required and must be 2-50 characters.';
    }
    if (tagIds.length === 0) {
        errors.tags = 'Please choose at least one valid tag.';
    }
    if (!Number.isInteger(pageCount) || pageCount <= 0) {
        errors.pageCount = 'Page count must be a positive whole number.';
    }
    if (!date || Number.isNaN(Date.parse(date))) {
        errors.date = 'Date is required and must be valid.';
    }

    return errors;
};

// Tags endpoint for dropdown values.
app.get('/tags', (request, response) => {
    connection.query('SELECT id, name, category, description FROM tags ORDER BY name ASC', (error, result) => {
        if (error) {
            console.log(error);
            return response.status(500).json({ message: 'Something went wrong with the server.' });
        }

        return response.json({ data: result });
    });
});

app.get('/categories', (request, response) => {
    connection.query('SELECT DISTINCT category FROM documents WHERE category IS NOT NULL AND category <> "" ORDER BY category ASC', (error, result) => {
        if (error) {
            console.log(error);
            return response.status(500).json({ message: 'Something went wrong with the server.' });
        }

        return response.json({
            data: result.map((row) => row.category)
        });
    });
});

// Secure filtering, sorting, and limit with parameterized query values.
app.get('/documents', (request, response) => {
    const {
        title,
        content,
        docType,
        category,
        tags,
        pageCount,
        date,
        limit,
        sortBy,
        sortDirection
    } = request.query;

    const whereClauses = [];
    const queryParameters = [];

    if (title) {
        whereClauses.push('d.title LIKE ?');
        queryParameters.push(`%${title}%`);
    }
    if (content) {
        whereClauses.push('d.content LIKE ?');
        queryParameters.push(`%${content}%`);
    }
    if (docType) {
        whereClauses.push('d.doc_type = ?');
        queryParameters.push(docType);
    }
    if (category) {
        whereClauses.push('d.category = ?');
        queryParameters.push(category);
    }
    const selectedTagIds = normalizeTagIds(tags);
    if (selectedTagIds.length > 0) {
        whereClauses.push(`dt.tags_id IN (${selectedTagIds.map(() => '?').join(', ')})`);
        queryParameters.push(...selectedTagIds);
    }
    if (pageCount) {
        whereClauses.push('d.page_count = ?');
        queryParameters.push(parseInt(pageCount, 10));
    }
    if (date) {
        whereClauses.push('DATE(d.created_at) = ?');
        queryParameters.push(date);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sortByMap = {
        title: 'd.title',
        docType: 'd.doc_type',
        category: 'd.category',
        pageCount: 'd.page_count',
        date: 'd.created_at'
    };

    const safeSortBy = sortByMap[sortBy] || 'd.created_at';
    const safeSortDirection = sortDirection === 'ASC' ? 'ASC' : 'DESC';

    const safeLimitNumber = parseInt(limit, 10);
    const safeLimit = Number.isInteger(safeLimitNumber) && safeLimitNumber > 0 && safeLimitNumber <= 100
        ? safeLimitNumber
        : 100;

    const sql = `
        SELECT
            d.id,
            d.title,
            d.content,
            d.doc_type,
            d.category,
            GROUP_CONCAT(t.name SEPARATOR ', ') AS tagName,
            d.page_count,
            d.created_at
        FROM documents d
        LEFT JOIN documents_to_tags dt ON d.id = dt.documents_id
        LEFT JOIN tags t ON t.id = dt.tags_id
        ${whereSql}
        GROUP BY d.id
        ORDER BY ${safeSortBy} ${safeSortDirection}
        LIMIT ?
    `;

    queryParameters.push(safeLimit);

    connection.query(sql, queryParameters, (error, result) => {
        if (error) {
            console.log(error);
            return response.status(500).json({ message: 'Something went wrong with the server.' });
        }

        return response.json({ data: result });
    });
});

app.get('/documents/:id', (request, response) => {
    const documentId = parseInt(request.params.id, 10);
    if (!Number.isInteger(documentId) || documentId <= 0) {
        return response.status(400).json({ message: 'Invalid document id.' });
    }

    const sql = `
        SELECT
            d.id,
            d.title,
            d.content,
            d.doc_type,
            d.category,
            d.page_count,
            DATE(d.created_at) AS created_at,
            GROUP_CONCAT(DISTINCT dt.tags_id ORDER BY dt.tags_id SEPARATOR ',') AS tagIds,
            GROUP_CONCAT(t.name SEPARATOR ', ') AS tagName
        FROM documents d
        LEFT JOIN documents_to_tags dt ON d.id = dt.documents_id
        LEFT JOIN tags t ON t.id = dt.tags_id
        WHERE d.id = ?
        GROUP BY d.id
        LIMIT 1
    `;

    connection.query(sql, [documentId], (error, result) => {
        if (error) {
            console.log(error);
            return response.status(500).json({ message: 'Something went wrong with the server.' });
        }

        if (result.length === 0) {
            return response.status(404).json({ message: 'Document not found.' });
        }

        return response.json({ data: result[0] });
    });
});

app.post('/documents', (request, response) => {
    const errors = validateInsertPayload(request.body);
    if (Object.keys(errors).length > 0) {
        return response.status(400).json({
            message: 'Validation failed.',
            errors
        });
    }

    const insertSql = `
        INSERT INTO documents (
            title,
            content,
            doc_type,
            category,
            page_count,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const queryParameters = [
        request.body.title.trim(),
        (request.body.content || 'No note content added.').trim(),
        request.body.docType.trim(),
        request.body.category.trim(),
        parseInt(request.body.pageCount, 10),
        request.body.date
    ];

    const tagIds = normalizeTagIds(request.body.tags);

    connection.beginTransaction((transactionError) => {
        if (transactionError) {
            console.log(transactionError);
            return response.status(500).json({ message: 'Something went wrong with the server.' });
        }

        connection.query(insertSql, queryParameters, (error, result) => {
            if (error) {
                return connection.rollback(() => {
                    console.log(error);
                    response.status(500).json({ message: 'Something went wrong with the server.' });
                });
            }

            const documentId = result.insertId;
            const junctionValues = tagIds.map((tagId) => [documentId, tagId]);

            if (junctionValues.length === 0) {
                return connection.rollback(() => {
                    response.status(400).json({
                        message: 'Validation failed.',
                        errors: {
                            tags: 'Please choose at least one valid tag.'
                        }
                    });
                });
            }

            const junctionSql = 'INSERT INTO documents_to_tags (documents_id, tags_id) VALUES ?';
            connection.query(junctionSql, [junctionValues], (junctionError) => {
                if (junctionError) {
                    return connection.rollback(() => {
                        if (junctionError.code === 'ER_NO_REFERENCED_ROW_2') {
                            response.status(400).json({
                                message: 'Validation failed.',
                                errors: {
                                    tags: 'One or more selected tags do not exist.'
                                }
                            });
                            return;
                        }

                        console.log(junctionError);
                        response.status(500).json({ message: 'Something went wrong with the server.' });
                    });
                }

                connection.commit((commitError) => {
                    if (commitError) {
                        return connection.rollback(() => {
                            console.log(commitError);
                            response.status(500).json({ message: 'Something went wrong with the server.' });
                        });
                    }

                    return response.status(201).json({
                        message: 'Document inserted successfully.',
                        insertedId: documentId
                    });
                });
            });
        });
    });
});

app.put('/documents/:id', (request, response) => {
    const documentId = parseInt(request.params.id, 10);
    if (!Number.isInteger(documentId) || documentId <= 0) {
        return response.status(400).json({ message: 'Invalid document id.' });
    }

    const errors = validateInsertPayload(request.body);
    if (Object.keys(errors).length > 0) {
        return response.status(400).json({
            message: 'Validation failed.',
            errors
        });
    }

    const tagIds = normalizeTagIds(request.body.tags);
    const updateSql = `
        UPDATE documents
        SET
            title = ?,
            content = ?,
            doc_type = ?,
            category = ?,
            page_count = ?,
            created_at = ?
        WHERE id = ?
    `;

    const updateParameters = [
        request.body.title.trim(),
        (request.body.content || 'No note content added.').trim(),
        request.body.docType.trim(),
        request.body.category.trim(),
        parseInt(request.body.pageCount, 10),
        request.body.date,
        documentId
    ];

    connection.beginTransaction((transactionError) => {
        if (transactionError) {
            console.log(transactionError);
            return response.status(500).json({ message: 'Something went wrong with the server.' });
        }

        connection.query(updateSql, updateParameters, (updateError, updateResult) => {
            if (updateError) {
                return connection.rollback(() => {
                    console.log(updateError);
                    response.status(500).json({ message: 'Something went wrong with the server.' });
                });
            }

            if (updateResult.affectedRows === 0) {
                return connection.rollback(() => {
                    response.status(404).json({ message: 'Document not found.' });
                });
            }

            connection.query('DELETE FROM documents_to_tags WHERE documents_id = ?', [documentId], (deleteError) => {
                if (deleteError) {
                    return connection.rollback(() => {
                        console.log(deleteError);
                        response.status(500).json({ message: 'Something went wrong with the server.' });
                    });
                }

                const junctionValues = tagIds.map((tagId) => [documentId, tagId]);
                if (junctionValues.length === 0) {
                    return connection.rollback(() => {
                        response.status(400).json({
                            message: 'Validation failed.',
                            errors: {
                                tags: 'Please choose at least one valid tag.'
                            }
                        });
                    });
                }

                const junctionSql = 'INSERT INTO documents_to_tags (documents_id, tags_id) VALUES ?';
                connection.query(junctionSql, [junctionValues], (junctionError) => {
                    if (junctionError) {
                        return connection.rollback(() => {
                            if (junctionError.code === 'ER_NO_REFERENCED_ROW_2') {
                                response.status(400).json({
                                    message: 'Validation failed.',
                                    errors: {
                                        tags: 'One or more selected tags do not exist.'
                                    }
                                });
                                return;
                            }

                            console.log(junctionError);
                            response.status(500).json({ message: 'Something went wrong with the server.' });
                        });
                    }

                    connection.commit((commitError) => {
                        if (commitError) {
                            return connection.rollback(() => {
                                console.log(commitError);
                                response.status(500).json({ message: 'Something went wrong with the server.' });
                            });
                        }

                        return response.status(200).json({
                            message: 'Document updated successfully.',
                            updatedId: documentId
                        });
                    });
                });
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log('Connecting to remote database student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com:3306');

    connection.connect((error) => {
        if (error) {
            console.error('Database connection failed:', error.code || error.message);
            return;
        }

        databaseReady = true;
        console.log('Database connection established.');
        ensureForeignKeysForJunctionTable();
    });
});