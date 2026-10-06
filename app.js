const apiBase = '';
const getTagSelect = () => document.getElementById('tags');
const getTagPicker = () => document.getElementById('tagsPicker');
const getSelectedTagsContainer = () => document.getElementById('selectedTags');

const getSelectedTagIds = () => Array.from(getTagSelect().selectedOptions)
    .map((option) => Number.parseInt(option.value, 10))
    .filter((tagId) => Number.isInteger(tagId) && tagId > 0);

const renderSelectedTagChips = () => {
    const container = getSelectedTagsContainer();
    const tagSelect = getTagSelect();
    container.innerHTML = '';

    getSelectedTagIds().forEach((tagId) => {
        const option = Array.from(tagSelect.options).find((entry) => Number.parseInt(entry.value, 10) === tagId);
        if (!option) {
            return;
        }

        const chip = document.createElement('span');
        chip.className = 'tagChip';
        chip.textContent = option.text;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'X';
        removeButton.setAttribute('aria-label', `Remove ${option.text}`);
        removeButton.addEventListener('click', () => {
            option.selected = false;
            renderSelectedTagChips();
        });

        chip.appendChild(removeButton);
        container.appendChild(chip);
    });
};

const initializeTagPicker = () => {
    const picker = getTagPicker();
    const tagSelect = getTagSelect();

    picker.addEventListener('change', () => {
        const selectedValue = Number.parseInt(picker.value, 10);
        if (!Number.isInteger(selectedValue) || selectedValue <= 0) {
            return;
        }

        const option = Array.from(tagSelect.options).find((entry) => Number.parseInt(entry.value, 10) === selectedValue);
        if (option) {
            option.selected = true;
            renderSelectedTagChips();
        }

        picker.value = '';
    });
};

const setMessage = (message) => {
    document.getElementById('resultsMessage').textContent = message;
};

const showErrorBanner = (message) => {
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');

    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
    successBanner.textContent = '';
    successBanner.classList.add('hidden');
};

const showSuccessBanner = (message) => {
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');

    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
    successBanner.textContent = message;
    successBanner.classList.remove('hidden');
};

const clearBanners = () => {
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');

    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
    successBanner.textContent = '';
    successBanner.classList.add('hidden');
};

const clearRows = () => {
    document.getElementById('resultsBody').innerHTML = '';
};

const showNoResults = () => {
    const body = document.getElementById('resultsBody');
    body.innerHTML = '<tr><td class="emptyRow" colspan="8">No results found.</td></tr>';
};

const openEditPage = (row) => {
    if (!row || !row.id) {
        return;
    }

    window.location.href = `edit.html?id=${encodeURIComponent(row.id)}`;
};

const openNoteAsFile = (row) => {
    const noteText = (row.content || '').trim();
    if (!noteText) {
        showErrorBanner('This note has no content to open as a file.');
        return;
    }

    const safeTitle = (row.title || 'note').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'note';
    const fileBlob = new Blob([noteText], { type: 'text/plain' });
    const fileUrl = URL.createObjectURL(fileBlob);

    const tempLink = document.createElement('a');
    tempLink.href = fileUrl;
    tempLink.target = '_blank';
    tempLink.download = `${safeTitle}.txt`;
    tempLink.click();

    setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
    }, 10000);
};

const openNoteModal = (row) => {
    document.getElementById('modalTitle').textContent = row.title || 'Note';
    document.getElementById('modalMeta').textContent = `${row.doc_type || ''} | ${row.category || ''} | ${row.tagName || ''} | ${row.created_at || ''}`;
    document.getElementById('modalBody').textContent = row.content || 'No content available.';

    const modal = document.getElementById('noteModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
};

const closeNoteModal = () => {
    const modal = document.getElementById('noteModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
};

const clearValidationErrors = () => {
    const fields = [
        'title',
        'docType',
        'category',
        'tags',
        'pageCount',
        'date',
        'limit'
    ];

    fields.forEach((field) => {
        const element = document.getElementById(`${field}Error`);
        if (element) {
            element.textContent = '';
        }
    });

    clearBanners();
};

const showValidationErrors = (errors) => {
    clearValidationErrors();

    let hasAnyError = false;
    Object.keys(errors).forEach((key) => {
        const errorElement = document.getElementById(`${key}Error`);
        if (errorElement) {
            errorElement.textContent = errors[key];
            hasAnyError = true;
        }
    });

    if (hasAnyError) {
        showErrorBanner('Please fix the validation errors and try again.');
    }
};

const renderRows = (rows) => {
    clearRows();
    const body = document.getElementById('resultsBody');

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        const cells = [
            row.title,
            row.doc_type,
            row.category,
            row.tagName,
            row.created_at
        ];

        cells.forEach((value) => {
            const td = document.createElement('td');
            td.textContent = value === null || value === undefined ? '' : value;
            tr.appendChild(td);
        });

        const actionCell = document.createElement('td');
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => {
            openEditPage(row);
        });
        actionCell.appendChild(editButton);
        tr.appendChild(actionCell);

        const openCell = document.createElement('td');
        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.textContent = 'View note';
        openButton.addEventListener('click', () => {
            openNoteModal(row);
        });
        openCell.appendChild(openButton);
        tr.appendChild(openCell);

        const fileCell = document.createElement('td');
        const fileButton = document.createElement('button');
        fileButton.type = 'button';
        fileButton.textContent = 'Open file';
        fileButton.addEventListener('click', () => {
            openNoteAsFile(row);
        });
        fileCell.appendChild(fileButton);
        tr.appendChild(fileCell);

        body.appendChild(tr);
    });
};

const loadCategories = () => {
    const categoryDropDown = document.getElementById('category');

    fetch(`/categories`, { method: 'GET' })
        .then((response) => response.json())
        .then((json) => {
            categoryDropDown.innerHTML = '';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.text = 'All categories';
            categoryDropDown.add(defaultOption);

            for (const category of json.data) {
                const option = document.createElement('option');
                option.value = category;
                option.text = category;
                categoryDropDown.add(option);
            }
        })
        .catch((error) => {
            console.error('Error loading categories:', error);
        });
};

const loadTags = () => {
    const tagSelect = getTagSelect();
    const tagPicker = getTagPicker();
    tagSelect.innerHTML = '';
    tagPicker.innerHTML = '';

    const pickerDefault = document.createElement('option');
    pickerDefault.value = '';
    pickerDefault.text = 'Select a tag...';
    tagPicker.add(pickerDefault);

    fetch(`/tags`, { method: 'GET' })
        .then((response) => response.json())
        .then((json) => {
            tagSelect.innerHTML = '';
            tagPicker.innerHTML = '';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.text = 'Select a tag...';
            tagPicker.add(defaultOption);

            for (const tag of json.data) {
                const optionText = `${tag.name} (${tag.category})`;

                const selectOption = document.createElement('option');
                selectOption.value = tag.id;
                selectOption.text = optionText;
                tagSelect.add(selectOption);

                const pickerOption = document.createElement('option');
                pickerOption.value = tag.id;
                pickerOption.text = optionText;
                tagPicker.add(pickerOption);
            }

            renderSelectedTagChips();
        })
        .catch((error) => {
            console.error('Error loading tags:', error);

            tagSelect.innerHTML = '';
            tagPicker.innerHTML = '';
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.text = 'Unable to load tags';
            tagPicker.add(errorOption);

            const errorBanner = document.getElementById('errorBanner');
            errorBanner.textContent = 'Could not load tags. Make sure the Node server is running.';
            errorBanner.classList.remove('hidden');
        });
};

const submitFilters = () => {
    const params = new URLSearchParams();

    const title = document.getElementById('title').value.trim();
    const docType = document.getElementById('docType').value.trim();
    const category = document.getElementById('category').value.trim();
    const tagIds = getSelectedTagIds();
    const pageCount = document.getElementById('pageCount').value.trim();
    const date = document.getElementById('date').value;
    const limit = document.getElementById('limit').value.trim();
    const sortBy = document.getElementById('sortBy').value;
    const sortDirection = document.getElementById('sortDirection').value;

    if (title) params.append('title', title);
    if (docType) params.append('docType', docType);
    if (category) params.append('category', category);
    tagIds.forEach((tagId) => params.append('tags', tagId));
    if (pageCount) params.append('pageCount', pageCount);
    if (date) params.append('date', date);
    if (limit) params.append('limit', limit);
    if (sortBy) params.append('sortBy', sortBy);
    if (sortDirection) params.append('sortDirection', sortDirection);

    fetch(`/documents?${params.toString()}`, { method: 'GET' })
        .then((response) => response.json())
        .then((json) => {
            const rows = json.data || [];
            if (rows.length === 0) {
                showNoResults();
            } else {
                renderRows(rows);
            }
            setMessage(`Showing ${rows.length} row(s).`);
        })
        .catch((error) => {
            console.error('Error loading documents:', error);
            setMessage('Unable to load documents.');
            showErrorBanner('Unable to load documents from the API.');
            showNoResults();
        });
};

document.getElementById('submitButton').addEventListener('click', (event) => {
    event.preventDefault();
    submitFilters();
});

document.getElementById('noteForm').addEventListener('submit', (event) => {
    event.preventDefault();
    submitFilters();
});

const insertButton = document.getElementById('insertButton');
if (insertButton) {
    insertButton.addEventListener('click', () => {
        window.location.href = 'insert.html';
    });
}

document.getElementById('closeModalButton').addEventListener('click', () => {
    closeNoteModal();
});

document.getElementById('noteModal').addEventListener('click', (event) => {
    if (event.target.id === 'noteModal') {
        closeNoteModal();
    }
});

loadCategories();
initializeTagPicker();
loadTags();
submitFilters();
