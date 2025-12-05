// Global Variables
let curriculumData = null;
let selectedLevel = null;
let selectedBranch = null;
let selectedSubject = null;

// Load Curriculum Data on Page Load
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/curriculum.json');
        curriculumData = await response.json();
    } catch (error) {
        console.error('Failed to load curriculum:', error);
    }
});

// Handle Level Change
function handleLevelChange() {
    const level = document.querySelector('input[name="level"]:checked');
    selectedLevel = level ? level.value : null;
    
    const branchContainer = document.getElementById('branchContainer');
    const subjectContainer = document.getElementById('subjectContainer');
    const questionContainer = document.getElementById('questionContainer');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!selectedLevel) {
        branchContainer.style.display = 'none';
        subjectContainer.style.display = 'none';
        questionContainer.style.display = 'none';
        submitBtn.style.display = 'none';
        return;
    }
    
    // For 1st year: show subjects directly
    if (selectedLevel === '1st') {
        branchContainer.style.display = 'none';
        populateSubjects('1st_year', null);
        subjectContainer.style.display = 'block';
        questionContainer.style.display = 'block';
        submitBtn.style.display = 'block';
    } 
    // For 2nd and 3rd year: show branches first
    else {
        branchContainer.style.display = 'block';
        populateBranches(selectedLevel);
        subjectContainer.style.display = 'none';
        questionContainer.style.display = 'none';
        submitBtn.style.display = 'none';
    }
    
    selectedBranch = null;
    selectedSubject = null;
}

// Populate Branches Dynamically
function populateBranches(level) {
    const branchSelector = document.getElementById('branchSelector');
    branchSelector.innerHTML = '';
    
    const levelKey = level === '2nd' ? '2nd_year' : '3rd_year';
    const branches = curriculumData.curriculum[levelKey].branches;
    
    Object.entries(branches).forEach(([key, branch]) => {
        const label = document.createElement('label');
        label.className = 'radio-label branch-option';
        label.innerHTML = `
            <input type="radio" name="branch" value="${key}" onchange="handleBranchChange('${key}')">
            ${branch.name}
        `;
        branchSelector.appendChild(label);
    });
}

// Handle Branch Change
function handleBranchChange(branchKey) {
    selectedBranch = branchKey;
    
    const subjectContainer = document.getElementById('subjectContainer');
    const questionContainer = document.getElementById('questionContainer');
    const submitBtn = document.getElementById('submitBtn');
    
    const levelKey = selectedLevel === '2nd' ? '2nd_year' : '3rd_year';
    populateSubjects(levelKey, branchKey);
    
    subjectContainer.style.display = 'block';
    questionContainer.style.display = 'block';
    submitBtn.style.display = 'block';
    
    selectedSubject = null;
}

// Populate Subjects Based on Level and Branch
function populateSubjects(levelKey, branchKey) {
    const subjectSelect = document.getElementById('subject');
    subjectSelect.innerHTML = '<option value="">-- اختر المادة --</option>';
    
    let subjects = [];
    
    if (levelKey === '1st_year') {
        subjects = curriculumData.curriculum['1st_year'].subjects;
    } else {
        const branch = curriculumData.curriculum[levelKey].branches[branchKey];
        subjects = branch.subjects;
    }
    
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectSelect.appendChild(option);
    });
    
    subjectSelect.addEventListener('change', (e) => {
        selectedSubject = e.target.value;
    });
}

// DOM Elements
const questionTextarea = document.getElementById('question');
const submitBtn = document.getElementById('submitBtn');
const responseSection = document.getElementById('responseSection');
const responseContent = document.getElementById('responseContent');
const errorSection = document.getElementById('errorSection');
const errorContent = document.getElementById('errorContent');

// Event Listeners
submitBtn.addEventListener('click', submitQuestion);
questionTextarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        submitQuestion();
    }
});

// Submit Question Function
async function submitQuestion() {
    // Get form data
    const level = document.querySelector('input[name="level"]:checked');
    const question = questionTextarea.value.trim();
    
    // Validation
    if (!level) {
        showError('⚠️ يجب اختيار المستوى الدراسي أولاً');
        return;
    }
    
    if (!selectedSubject) {
        showError('⚠️ يجب اختيار المادة أولاً');
        return;
    }
    
    if (selectedLevel !== '1st' && !selectedBranch) {
        showError('⚠️ يجب اختيار الشعبة أولاً');
        return;
    }

    if (!question) {
        showError('⚠️ يجب كتابة السؤال أولاً');
        return;
    }

    if (question.length < 5) {
        showError('⚠️ السؤال قصير جداً، يجب أن يكون أطول من 5 أحرف');
        return;
    }

    // Show loading state
    submitBtn.disabled = true;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    responseSection.style.display = 'none';
    errorSection.style.display = 'none';

    try {
        // Send request to backend
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                level: level.value,
                branch: selectedBranch || null,
                subject: selectedSubject
            })
        });

        const data = await response.json();

        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';

        if (!response.ok) {
            showError(data.error || 'حدث خطأ في معالجة طلبك');
            return;
        }

        // Display response
        if (data.response) {
            // Format the response
            const formattedResponse = formatResponse(data.response);
            responseContent.innerHTML = formattedResponse;
            responseSection.style.display = 'block';
        }

    } catch (error) {
        console.error('Error:', error);
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        showError('❌ خطأ في الاتصال بالخادم. تأكد من اتصالك بالإنترنت.');
    }
}

// Format Response
function formatResponse(text) {
    let formatted = text
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Convert line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // Bold text between **
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic text between *
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Numbered lists
        .replace(/^(\d+)\./gm, '<strong>$1.</strong>')
        // Convert bullet points
        .replace(/^[-•]\s/gm, '• ')
        // Headers
        .replace(/^#{1,6}\s(.+)/gm, '<h4>$1</h4>');

    return `<p>${formatted}</p>`;
}

// Show Error
function showError(message) {
    errorContent.textContent = message;
    errorSection.style.display = 'block';
    responseSection.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loader').style.display = 'none';
}

// Close Response
function closeResponse() {
    responseSection.style.display = 'none';
}

// Close Error
function closeError() {
    errorSection.style.display = 'none';
}

// Copy Response
function copyResponse() {
    const text = responseContent.innerText;
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ تم النسخ!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('فشل نسخ الإجابة');
    });
}

// New Question
function newQuestion() {
    questionTextarea.value = '';
    document.querySelectorAll('input[name="level"]').forEach(input => input.checked = false);
    document.querySelectorAll('input[name="branch"]').forEach(input => input.checked = false);
    document.getElementById('subject').value = '';
    
    document.getElementById('branchContainer').style.display = 'none';
    document.getElementById('subjectContainer').style.display = 'none';
    document.getElementById('questionContainer').style.display = 'none';
    document.getElementById('submitBtn').style.display = 'none';
    
    responseSection.style.display = 'none';
    errorSection.style.display = 'none';
    
    selectedLevel = null;
    selectedBranch = null;
    selectedSubject = null;
}

// API Health Check on page load
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/api/health');
        if (!response.ok) {
            console.warn('Server health check failed');
        }
    } catch (error) {
        console.error('Server connection failed:', error);
        showError('⚠️ تحذير: قد تواجه مشاكل في الاتصال بالخادم');
    }
});
