function validateInsertInputs() {
    const errors = {};

    const title = document.getElementById('title').value.trim();
    const docType = document.getElementById('docType').value.trim();
    const category = document.getElementById('category').value.trim();
    const selectedTagIds = Array.from(document.getElementById('tags').selectedOptions)
        .map((option) => Number.parseInt(option.value, 10))
        .filter((tagId) => Number.isInteger(tagId) && tagId > 0);
    const pageCount = document.getElementById('pageCount').value.trim();
    const date = document.getElementById('date').value;

    if (!title || title.length < 3 || title.length > 100) {
        errors.title = 'Title is required and must be 3-100 characters.';
    }
    if (!docType || docType.length < 2 || docType.length > 50) {
        errors.docType = 'Doc type is required and must be 2-50 characters.';
    }
    if (!category || category.length < 2 || category.length > 50) {
        errors.category = 'Category is required and must be 2-50 characters.';
    }
    if (selectedTagIds.length === 0) {
        errors.tags = 'Please choose at least one valid tag.';
    }
    if (!pageCount || Number.isNaN(Number.parseInt(pageCount, 10)) || Number.parseInt(pageCount, 10) <= 0) {
        errors.pageCount = 'Page count must be a positive whole number.';
    }
    if (!date) {
        errors.date = 'Date is required.';
    }

    return errors;
}
