import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Load Curriculum Data
let curriculumData = null;
let questionsBank = null;
try {
  const curriculumPath = path.join(process.cwd(), 'public', 'curriculum.json');
  const curriculumContent = fs.readFileSync(curriculumPath, 'utf8');
  curriculumData = JSON.parse(curriculumContent);

  const questionsBankPath = path.join(process.cwd(), 'public', 'questions-bank.json');
  const questionsBankContent = fs.readFileSync(questionsBankPath, 'utf8');
  questionsBank = JSON.parse(questionsBankContent);
} catch (error) {
  console.error('Error loading data files:', error);
}

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// System Prompt
const SYSTEM_PROMPT = `أنت مساعد تربوي جزائري متخصص في تقديم الإجابات حصريًا وفق المنهاج الرسمي للتعليم الثانوي الجزائري.

📌 دورك:
- الإجابة على أسئلة التلاميذ في جميع مواد التعليم الثانوي
- تقديم الشرح والتوضيح والحلول فقط إذا كانت من داخل المقررات الدراسية الجزائرية الرسمية
- عدم إضافة معلومات غير موجودة في البرنامج الرسمي

📌 قواعد صارمة:
1. إذا جاء سؤال خارج المنهاج الرسمي: "هذا السؤال خارج المنهاج الجزائري للثانوي."
2. لا تذكر مصادر خارج الكتب المدرسية الجزائرية الرسمية
3. بالعربية الفصحى المبسّطة`;

// Validation function
function validateQuestion(level, branch, subject, question) {
  if (!level || !['1st', '2nd', '3rd'].includes(level)) {
    return { valid: false, message: 'المستوى الدراسي غير صحيح' };
  }

  if (level !== '1st' && !branch) {
    return { valid: false, message: 'الشعبة مطلوبة للسنة الثانية والثالثة' };
  }

  if (!subject) {
    return { valid: false, message: 'يجب تحديد المادة' };
  }

  let validSubjects = [];
  if (level === '1st') {
    validSubjects = curriculumData.curriculum['1st_year'].subjects;
  } else if (level === '2nd') {
    validSubjects = curriculumData.curriculum['2nd_year'].branches[branch]?.subjects || [];
  } else if (level === '3rd') {
    validSubjects = curriculumData.curriculum['3rd_year'].branches[branch]?.subjects || [];
  }

  if (!validSubjects.includes(subject)) {
    return { 
      valid: false, 
      message: `المادة "${subject}" غير موجودة في برنامج ${level === '1st' ? 'السنة الأولى' : level === '2nd' ? 'السنة الثانية' : 'السنة الثالثة'}`
    };
  }

  return { valid: true, message: 'سؤال صحيح' };
}

// API Routes
app.post('/api/ask', async (req, res) => {
  try {
    const { level, branch, subject, question } = req.body;

    const validation = validateQuestion(level, branch, subject, question);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    if (!genAI) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `${SYSTEM_PROMPT}\n\nالسؤال: ${question}`
        }]
      }],
      systemInstruction: SYSTEM_PROMPT
    });

    const response = result.response.text();
    res.json({ answer: response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'حدث خطأ في معالجة السؤال' });
  }
});

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { userType, level, branch, subject, questionCount, difficulty, questionType, includeAnswerKey, includeSolutions, includeMarkingScheme } = req.body;

    if (!userType || !level || !subject || !questionCount) {
      return res.status(400).json({ error: 'يجب تحديد جميع المعلومات المطلوبة' });
    }

    const validation = validateQuestion(level, branch, subject, '');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    let levelLabel = level === '1st' ? 'السنة الأولى ثانوي' : 
                     level === '2nd' ? 'السنة الثانية ثانوي' : 
                     'السنة الثالثة ثانوي (بكالوريا)';

    let branchLabel = '';
    if (level !== '1st' && branch) {
      const levelKey = level === '2nd' ? '2nd_year' : '3rd_year';
      branchLabel = curriculumData.curriculum[levelKey].branches[branch].name;
    }

    const difficultyLabel = difficulty === 'easy' ? 'سهل' : 
                           difficulty === 'medium' ? 'متوسط' : 'صعب';

    let selectedQuestions = [];
    const subjectQuestions = questionsBank.questions_bank[subject];
    
    if (subjectQuestions) {
      const difficultyQuestions = subjectQuestions[difficulty] || subjectQuestions.easy || [];
      selectedQuestions = difficultyQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(questionCount, difficultyQuestions.length));
    }

    let questionsHtml = '';
    selectedQuestions.forEach((q, index) => {
      questionsHtml += `
        <div class="question-item">
          <p><strong>السؤال ${index + 1}:</strong> ${q.question}</p>
      `;
      
      if (q.type === 'mcq') {
        questionsHtml += '<div class="question-options">';
        q.options.forEach((option, optIndex) => {
          questionsHtml += `<div class="option-item">
            <strong>${String.fromCharCode(97 + optIndex)}):</strong> ${option}
          </div>`;
        });
        questionsHtml += '</div>';
      }
      questionsHtml += '</div>';
    });

    let answerKeyHtml = '';
    if (includeAnswerKey && userType === 'teacher') {
      answerKeyHtml += '<h4>🔑 مفتاح الإجابات:</h4>';
      selectedQuestions.forEach((q, index) => {
        answerKeyHtml += `<p><strong>السؤال ${index + 1}:</strong> ${q.correct}</p>`;
      });
    }

    let solutionsHtml = '';
    if (includeSolutions && userType === 'teacher') {
      solutionsHtml += '<h4>💡 الحلول والشروحات:</h4>';
      selectedQuestions.forEach((q, index) => {
        solutionsHtml += `
          <div style="background: #f9fafb; padding: 12px; margin: 10px 0; border-radius: 8px;">
            <p><strong>السؤال ${index + 1}:</strong></p>
            <p>${q.solution}</p>
          </div>
        `;
      });
    }

    res.json({
      success: true,
      subject: subject,
      levelLabel: levelLabel,
      branchLabel: branchLabel,
      questionCount: selectedQuestions.length,
      difficulty: difficulty,
      difficultyLabel: difficultyLabel,
      questions: `<div class="questions-list">${questionsHtml}</div>`,
      answerKey: answerKeyHtml ? `<div class="answer-key">${answerKeyHtml}</div>` : null,
      solutions: solutionsHtml ? `<div class="solutions">${solutionsHtml}</div>` : null,
      markingScheme: includeMarkingScheme ? `<div class="marking-scheme"><h4>📊 سلم التقييم:</h4><p>عدد الأسئلة: ${selectedQuestions.length}</p><p>الدرجة لكل سؤال: ${(100 / selectedQuestions.length).toFixed(2)} نقطة</p></div>` : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'حدث خطأ في إنشاء الأسئلة' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

export const handler = serverless(app);
