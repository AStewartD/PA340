const apiBase = 'http://localhost';

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

const showErrorBanner = (message) => {
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');

    successBanner.textContent = '';
    successBanner.classList.add('hidden');
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
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
        showErrorBanner('Please fix the validation errors and try again.');
    }
};

const loadCategories = () => {
    const categoryDropDown = document.getElementById('category');

    fetch(`${apiBase}/categories`, { method: 'GET' })
        .then((response) => response.json())
        .then((json) => {
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
        })
        .catch((error) => {
            console.error('Error loading categories:', error);
            showErrorBanner('Could not load categories. Make sure the Node server is running.');
        });
};

const loadTags = () => {
    const tagSelect = getTagSelect();
    const tagPicker = getTagPicker();

    tagSelect.innerHTML = '';
    tagPicker.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.text = 'Select a tag...';
    tagPicker.add(defaultOption);

    fetch(`${apiBase}/tags`, { method: 'GET' })
        .then((response) => response.json())
        .then((json) => {
            tagSelect.innerHTML = '';
            tagPicker.innerHTML = '';

            const pickerDefault = document.createElement('option');
            pickerDefault.value = '';
            pickerDefault.text = 'Select a tag...';
            tagPicker.add(pickerDefault);

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
        })
        .catch((error) => {
            console.error('Error loading tags:', error);
            showErrorBanner('Could not load tags. Make sure the Node server is running.');
        });
};

const resetInsertForm = () => {
    document.getElementById('insertForm').reset();
    Array.from(getTagSelect().options).forEach((option) => {
        option.selected = false;
    });
    renderSelectedTagChips();
};

const insertNote = () => {
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

    fetch(`${apiBase}/documents`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
        .then(async (response) => {
            const payload = await response.json();
            if (!response.ok) {
                if (response.status === 400 && payload.errors) {
                    showValidationErrors(payload.errors);
                }
                throw new Error(payload.message || 'Insert failed.');
            }

            showSuccessBanner(payload.message || 'Insert successful.');
            setMessage('Note inserted. You can add another or go back to Notes.');
            resetInsertForm();
        })
        .catch((error) => {
            if (!document.getElementById('errorBanner').textContent) {
                showErrorBanner(error.message);
            }
        });
};

document.getElementById('insertForm').addEventListener('submit', (event) => {
    event.preventDefault();
    insertNote();
});

initializeTagPicker();
loadCategories();
loadTags();
