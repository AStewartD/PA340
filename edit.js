const apiBase = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
const documentId = urlParams.get('id');

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

const clearBanners = () => {
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');

    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
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
        const errorBanner = document.getElementById('errorBanner');
        errorBanner.textContent = 'Please fix the validation errors and try again.';
        errorBanner.classList.remove('hidden');
    }
};

const showErrorBanner = (message) => {
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');

    successBanner.textContent = '';
    successBanner.classList.add('hidden');
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
};

const loadCategories = async () => {
    const categoryDropDown = document.getElementById('category');
    const response = await fetch(`${apiBase}/categories`, { method: 'GET' });
    const json = await response.json();

    categoryDropDown.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.text = 'Select category';
    categoryDropDown.add(defaultOption);

    for (const category of json.data || []) {
        const option = document.createElement('option');
        option.value = category;
        option.text = category;
        categoryDropDown.add(option);
    }
};

const loadTags = async () => {
    const tagSelect = getTagSelect();
    const tagPicker = getTagPicker();
    const response = await fetch(`${apiBase}/tags`, { method: 'GET' });
    const json = await response.json();

    tagSelect.innerHTML = '';
    tagPicker.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.text = 'Select a tag...';
    tagPicker.add(defaultOption);

    for (const tag of json.data || []) {
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
};

const fillForm = (row) => {
    document.getElementById('title').value = row.title || '';
    document.getElementById('docType').value = row.doc_type || '';
    document.getElementById('category').value = row.category || '';
    const selectedTagIds = String(row.tagIds || '')
        .split(',')
        .map((value) => Number.parseInt(value, 10))
        .filter((tagId) => Number.isInteger(tagId) && tagId > 0);

    const tagDropDown = getTagSelect();
    Array.from(tagDropDown.options).forEach((option) => {
        const optionId = Number.parseInt(option.value, 10);
        option.selected = selectedTagIds.includes(optionId);
    });
    renderSelectedTagChips();
    document.getElementById('pageCount').value = row.page_count || '';
    document.getElementById('date').value = row.created_at ? String(row.created_at).split('T')[0] : '';
    document.getElementById('content').value = row.content || '';
};

const loadDocument = async () => {
    if (!documentId || Number.isNaN(Number.parseInt(documentId, 10))) {
        showErrorBanner('Missing or invalid note id in URL. Use edit.html?id=123');
        return;
    }

    const response = await fetch(`${apiBase}/documents/${encodeURIComponent(documentId)}`, { method: 'GET' });
    const json = await response.json();

    if (!response.ok) {
        throw new Error(json.message || 'Unable to load note.');
    }

    fillForm(json.data);
};

const saveChanges = async () => {
    const clientErrors = validateInsertInputs();
    if (Object.keys(clientErrors).length > 0) {
        showValidationErrors(clientErrors);
        return;
    }

    clearValidationErrors();

    const body = {
        title: document.getElementById('title').value.trim(),
        docType: document.getElementById('docType').value.trim(),
        category: document.getElementById('category').value.trim(),
        tags: getSelectedTagIds(),
        pageCount: document.getElementById('pageCount').value.trim(),
        date: document.getElementById('date').value,
        content: document.getElementById('content').value.trim()
    };

    const response = await fetch(`${apiBase}/documents/${encodeURIComponent(documentId)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
        if (response.status === 400 && payload.errors) {
            showValidationErrors(payload.errors);
        }
        throw new Error(payload.message || 'Update failed.');
    }

    showSuccessBanner(payload.message || 'Update successful.');
    setMessage(payload.message || 'Update successful.');
};

document.getElementById('editForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        await saveChanges();
    } catch (error) {
        if (!document.getElementById('errorBanner').textContent) {
            showErrorBanner(error.message);
        }
    }
});

const initializeEditPage = async () => {
    try {
        initializeTagPicker();
        await loadCategories();
        await loadTags();
        await loadDocument();
    } catch (error) {
        showErrorBanner(error.message || 'Could not load edit page data.');
    }
};

initializeEditPage();
