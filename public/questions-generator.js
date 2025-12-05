// Global Variables
let curriculumData = null;
let selectedQLevel = null;
let selectedQBranch = null;
let selectedQSubject = null;
let selectedUserType = null;

// Load Curriculum Data on Page Load
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/curriculum.json');
        curriculumData = await response.json();
        // Show questions section by default
        document.getElementById('questions-section').style.display = 'block';
    } catch (error) {
        console.error('Failed to load curriculum:', error);
    }
});

// Switch between tabs
function switchTab(tab) {
    const answersSection = document.querySelector('.input-section');
    const questionsSection = document.getElementById('questions-section');
    const navTabs = document.querySelectorAll('.nav-tab');
    
    navTabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'answers') {
        answersSection.style.display = 'block';
        questionsSection.style.display = 'none';
        event.target.classList.add('active');
    } else {
        answersSection.style.display = 'none';
        questionsSection.style.display = 'block';
        event.target.classList.add('active');
    }
}

// Handle User Type Change
function handleUserTypeChange() {
    selectedUserType = document.querySelector('input[name="userType"]:checked').value;
    const teacherOptions = document.getElementById('teacherOptions');
    
    if (selectedUserType === 'teacher') {
        teacherOptions.style.display = 'block';
    } else {
        teacherOptions.style.display = 'none';
    }
}

// Handle Question Level Change
function handleQLevelChange() {
    selectedQLevel = document.querySelector('input[name="qLevel"]:checked').value;
    
    const qBranchContainer = document.getElementById('qBranchContainer');
    const qSubjectContainer = document.getElementById('qSubjectContainer');
    const qCountContainer = document.getElementById('qCountContainer');
    const qDifficultyContainer = document.getElementById('qDifficultyContainer');
    const qTypeContainer = document.getElementById('qTypeContainer');
    const generateBtn = document.getElementById('generateQuestionsBtn');
    
    if (!selectedQLevel) {
        qBranchContainer.style.display = 'none';
        qSubjectContainer.style.display = 'none';
        qCountContainer.style.display = 'none';
        qDifficultyContainer.style.display = 'none';
        qTypeContainer.style.display = 'none';
        generateBtn.style.display = 'none';
        return;
    }
    
    if (selectedQLevel === '1st') {
        qBranchContainer.style.display = 'none';
        populateQSubjects('1st_year', null);
        qSubjectContainer.style.display = 'block';
        qCountContainer.style.display = 'block';
        qDifficultyContainer.style.display = 'block';
        qTypeContainer.style.display = 'block';
        generateBtn.style.display = 'block';
    } else {
        qBranchContainer.style.display = 'block';
        populateQBranches(selectedQLevel);
        qSubjectContainer.style.display = 'none';
        qCountContainer.style.display = 'none';
        qDifficultyContainer.style.display = 'none';
        qTypeContainer.style.display = 'none';
        generateBtn.style.display = 'none';
    }
    
    selectedQBranch = null;
    selectedQSubject = null;
}

// Populate Question Branches
function populateQBranches(level) {
    const branchSelector = document.getElementById('qBranchSelector');
    branchSelector.innerHTML = '';
    
    const levelKey = level === '2nd' ? '2nd_year' : '3rd_year';
    const branches = curriculumData.curriculum[levelKey].branches;
    
    Object.entries(branches).forEach(([key, branch]) => {
        const label = document.createElement('label');
        label.className = 'radio-label branch-option';
        label.innerHTML = `
            <input type="radio" name="qBranch" value="${key}" onchange="handleQBranchChange('${key}')">
            ${branch.name}
        `;
        branchSelector.appendChild(label);
    });
}

// Handle Question Branch Change
function handleQBranchChange(branchKey) {
    selectedQBranch = branchKey;
    
    const qSubjectContainer = document.getElementById('qSubjectContainer');
    const qCountContainer = document.getElementById('qCountContainer');
    const qDifficultyContainer = document.getElementById('qDifficultyContainer');
    const qTypeContainer = document.getElementById('qTypeContainer');
    const generateBtn = document.getElementById('generateQuestionsBtn');
    
    const levelKey = selectedQLevel === '2nd' ? '2nd_year' : '3rd_year';
    populateQSubjects(levelKey, branchKey);
    
    qSubjectContainer.style.display = 'block';
    qCountContainer.style.display = 'block';
    qDifficultyContainer.style.display = 'block';
    qTypeContainer.style.display = 'block';
    generateBtn.style.display = 'block';
    
    selectedQSubject = null;
}

// Populate Question Subjects
function populateQSubjects(levelKey, branchKey) {
    const subjectSelect = document.getElementById('qSubject');
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
}

// Handle Subject Change
function handleSubjectChange() {
    selectedQSubject = document.getElementById('qSubject').value;
}

// Generate Questions
async function generateQuestions() {
    // Validation
    if (!selectedUserType) {
        showQError('⚠️ يجب اختيار نوع المستخدم أولاً');
        return;
    }
    
    if (!selectedQLevel) {
        showQError('⚠️ يجب اختيار المستوى الدراسي أولاً');
        return;
    }
    
    if (selectedQLevel !== '1st' && !selectedQBranch) {
        showQError('⚠️ يجب اختيار الشعبة أولاً');
        return;
    }
    
    if (!selectedQSubject) {
        showQError('⚠️ يجب اختيار المادة أولاً');
        return;
    }
    
    const questionCount = parseInt(document.getElementById('qCount').value);
    const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
    const questionType = document.querySelector('input[name="qType"]:checked').value;
    
    if (questionCount < 1 || questionCount > 10) {
        showQError('⚠️ عدد الأسئلة يجب أن يكون بين 1 و 10');
        return;
    }
    
    // Show loading state
    const generateBtn = document.getElementById('generateQuestionsBtn');
    generateBtn.disabled = true;
    const btnText = generateBtn.querySelector('.btn-text');
    const btnLoader = generateBtn.querySelector('.btn-loader');
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    
    try {
        const apiUrl = window.location.hostname === 'localhost' ? '/api/generate-questions' : '/.netlify/functions/api/generate-questions';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userType: selectedUserType,
                level: selectedQLevel,
                branch: selectedQBranch || null,
                subject: selectedQSubject,
                questionCount: questionCount,
                difficulty: difficulty,
                questionType: questionType,
                includeAnswerKey: document.getElementById('includeAnswerKey')?.checked,
                includeSolutions: document.getElementById('includeSolutions')?.checked,
                includeMarkingScheme: document.getElementById('includeMarkingScheme')?.checked
            })
        });
        
        const data = await response.json();
        
        generateBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        
        if (!response.ok) {
            showQError(data.error || 'حدث خطأ في إنشاء الأسئلة');
            return;
        }
        
        // Display questions
        if (data.questions) {
            displayQuestions(data);
        }
        
    } catch (error) {
        console.error('Error:', error);
        generateBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        showQError('❌ خطأ في الاتصال بالخادم');
    }
}

// Display Questions
function displayQuestions(data) {
    const questionsContent = document.getElementById('questionsContent');
    const questionsOutput = document.getElementById('questions-output');
    
    if (!questionsContent || !questionsOutput) {
        console.error('Missing questionsContent or questionsOutput elements');
        return;
    }
    
    console.log('Displaying questions:', data);
    
    let html = `
        <div class="questions-header">
            <h3>📋 الأسئلة المُنشأة</h3>
            <p><strong>المادة:</strong> ${data.subject}</p>
            <p><strong>المستوى:</strong> ${data.levelLabel}${data.branchLabel ? ` - ${data.branchLabel}` : ''}</p>
            <p><strong>عدد الأسئلة:</strong> ${data.questionCount}</p>
            <p><strong>مستوى الصعوبة:</strong> ${data.difficultyLabel}</p>
        </div>
    `;
    
    // Add questions
    if (data.questions) {
        html += data.questions;
    }
    
    // Add answer key if present
    if (data.answerKey) {
        html += data.answerKey;
    }
    
    // Add solutions if present
    if (data.solutions) {
        html += data.solutions;
    }
    
    // Add marking scheme if present
    if (data.markingScheme) {
        html += data.markingScheme;
    }
    
    // Set the content
    questionsContent.innerHTML = html;
    
    // Show the output section and hide error section
    questionsOutput.style.display = 'block';
    document.getElementById('qErrorSection').style.display = 'none';
    
    console.log('Questions displayed successfully');
}

// Show Question Error
function showQError(message) {
    document.getElementById('qErrorContent').textContent = message;
    document.getElementById('qErrorSection').style.display = 'block';
    document.getElementById('questions-output').style.display = 'none';
}

// Close Question Error
function closeQError() {
    document.getElementById('qErrorSection').style.display = 'none';
}

// Close Questions Output
function closeQuestionsOutput() {
    document.getElementById('questions-output').style.display = 'none';
}

// Create New Questions
function createNewQuestions() {
    document.getElementById('qCount').value = '5';
    document.querySelectorAll('input[name="qLevel"]').forEach(input => input.checked = false);
    document.querySelectorAll('input[name="qBranch"]').forEach(input => input.checked = false);
    document.getElementById('qSubject').value = '';
    document.getElementById('questions-output').style.display = 'none';
    document.getElementById('qErrorSection').style.display = 'none';
    
    selectedQLevel = null;
    selectedQBranch = null;
    selectedQSubject = null;
}

// Download Questions as PDF
function downloadQuestions() {
    alert('سيتم تنزيل PDF قريباً...');
    // TODO: Implement PDF download functionality
}

// Print Questions
function printQuestions() {
    const questionsContent = document.getElementById('questionsContent');
    const printWindow = window.open('', '', 'height=400,width=600');
    printWindow.document.write(questionsContent.innerHTML);
    printWindow.document.close();
    printWindow.print();
}

// Copy Questions Text
function copyQuestionsText() {
    const questionsContent = document.getElementById('questionsContent');
    const text = questionsContent.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ تم النسخ!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('فشل نسخ الأسئلة');
    });
}

// Event Listener for Generate Button
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateQuestionsBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateQuestions);
    }
});
