import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load Curriculum Data
let curriculumData = null;
let questionsBank = null;
try {
  const curriculumPath = path.join(__dirname, 'public', 'curriculum.json');
  const curriculumContent = fs.readFileSync(curriculumPath, 'utf8');
  curriculumData = JSON.parse(curriculumContent);

  const questionsBankPath = path.join(__dirname, 'public', 'questions-bank.json');
  const questionsBankContent = fs.readFileSync(questionsBankPath, 'utf8');
  questionsBank = JSON.parse(questionsBankContent);
} catch (error) {
  console.error('Error loading data files:', error);
}

// Initialize Gemini AI
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ خطأ حرج: GEMINI_API_KEY غير معرّف في ملف .env');
  console.error('📌 يجب إضافة مفتاح API من Google Gemini إلى ملف .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enhanced System Prompt with Curriculum Validation
const SYSTEM_PROMPT = `أنت مساعد تربوي جزائري متخصص في تقديم الإجابات حصريًا وفق المنهاج الرسمي للتعليم الثانوي الجزائري.

📌 دورك:
- الإجابة على أسئلة التلاميذ في جميع مواد التعليم الثانوي (الأولى، الثانية، الثالثة ثانوي).
- تقديم الشرح والتوضيح والحلول فقط إذا كانت من داخل المقررات الدراسية الجزائرية الرسمية.
- عدم إضافة معلومات غير موجودة في البرنامج الرسمي مهما كانت صحيحة علمياً.
- تقديم الإجابة بلغة عربية فصحى مبسّطة تناسب مستوى التلاميذ.

📌 المواد المشمولة:
- الرياضيات
- الفيزياء والكيمياء
- العلوم الطبيعية
- الأدب العربي
- الفلسفة
- التاريخ والجغرافيا
- اللغة الفرنسية
- اللغة الإنجليزية
- العلوم الإسلامية
- التكنولوجيا
- العلوم الاقتصادية والتسيير
- الإعلام الآلي

📌 قواعس صارمة جداً:
1. إذا جاء سؤال خارج المنهاج الرسمي أو خارج مستويات الثانوي:
   الإجابة الإلزامية فقط: "هذا السؤال خارج المنهاج الجزائري للثانوي."
2. لا تذكر مصادر خارج الكتب المدرسية الجزائرية الرسمية.
3. لا تستعمل معلومات من خارج السياق الدراسي الجزائري تماماً.
4. إذا طلب الطالب شرحًا، قدمه وفق طريقة بيداغوجية مع أمثلة من نفس الدرس فقط.
5. إذا كان السؤال يتعلّق بتمرين بكالوريا، قدم الحل وفق منهجية الحل المعتمدة في الجزائر.
6. في حالة الشك، أجب برفض السؤال لأنه قد يكون خارج المنهاج.

أسلوب الإجابة:
- واضح، مباشر، مفيد، بالعربية الفصحى.
- دون إضافات غير ضرورية.
- بدون محتوى خارج نطاق المناهج الجزائرية.`;

// Validation function for curriculum
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

  // Check if subject exists in curriculum
  let validSubjects = [];
  if (level === '1st') {
    validSubjects = curriculumData.curriculum['1st_year'].subjects;
  } else {
    const levelKey = level === '2nd' ? '2nd_year' : '3rd_year';
    const branchData = curriculumData.curriculum[levelKey].branches[branch];
    if (!branchData) {
      return { valid: false, message: 'الشعبة المحددة غير موجودة' };
    }
    validSubjects = branchData.subjects;
  }

  if (!validSubjects.includes(subject)) {
    return { valid: false, message: 'المادة المحددة ليست موجودة في هذه الشعبة' };
  }

  return { valid: true, message: 'تم التحقق بنجاح' };
}

// API Endpoint
app.post('/api/ask', async (req, res) => {
  try {
    const { question, level, branch, subject } = req.body;

    // Validation
    if (!question || !level) {
      return res.status(400).json({
        error: 'يجب تحديد السؤال والمستوى الدراسي',
        response: null
      });
    }

    // Validate against curriculum
    const validation = validateQuestion(level, branch, subject, question);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.message,
        response: null
      });
    }

    // Get branch/subject info for prompt context
    let subjectInfo = subject || '';
    let branchInfo = '';
    
    if (level !== '1st' && branch) {
      const levelKey = level === '2nd' ? '2nd_year' : '3rd_year';
      const branchData = curriculumData.curriculum[levelKey].branches[branch];
      branchInfo = branchData.name;
    }

    const levelLabel = level === '1st' ? 'السنة الأولى ثانوي' : 
                       level === '2nd' ? 'السنة الثانية ثانوي' : 
                       'السنة الثالثة ثانوي (بكالوريا)';

    // Create the full prompt with detailed context
    const contextualPrompt = `${SYSTEM_PROMPT}

📌 المعلومات الدقيقة للسؤال:
- المستوى الدراسي: ${levelLabel}
${branchInfo ? `- الشعبة: ${branchInfo}` : ''}
- المادة: ${subjectInfo}

سؤال الطالب:
${question}

تذكير: يجب أن تكون الإجابة حصريًا من منهاج ${levelLabel}${branchInfo ? ` شعبة ${branchInfo}` : ''}.`;

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    try {
      const result = await model.generateContent(contextualPrompt);
      const response = await result.response;
      const text = response.text();
      
      res.json({
        success: true,
        question: question,
        level: level,
        branch: branch || null,
        subject: subject,
        response: text,
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      console.error('API Error details:', apiError.message);
      throw apiError;
    }

  } catch (error) {
    console.error('Error:', error);
    
    // Check if it's an API key error
    if (error.message && error.message.includes('API')) {
      return res.status(500).json({
        error: 'خطأ في مفتاح API. تأكد من إضافة Google Gemini API Key الصحيح في ملف .env',
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
    
    res.status(500).json({
      error: 'حدث خطأ في معالجة طلبك',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// API Endpoint for Generating Questions
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { userType, level, branch, subject, questionCount, difficulty, questionType, includeAnswerKey, includeSolutions, includeMarkingScheme } = req.body;

    // Validation
    if (!userType || !level || !subject || !questionCount) {
      return res.status(400).json({
        error: 'يجب تحديد جميع المعلومات المطلوبة'
      });
    }

    // Validate against curriculum
    const validation = validateQuestion(level, branch, subject, '');
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.message
      });
    }

    // Get level and branch labels
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

    // Create prompt for AI to generate questions
    const generatePrompt = `أنت معلم تربوي متخصص في إنشاء أسئلة تعليمية مميزة.

📌 المعلومات:
- المادة: ${subject}
- المستوى: ${levelLabel}${branchLabel ? ` - ${branchLabel}` : ''}
- عدد الأسئلة: ${questionCount}
- مستوى الصعوبة: ${difficultyLabel}
- نوع الأسئلة: ${questionType === 'mcq' ? 'متعددة الخيارات' : questionType === 'truefalse' ? 'صحيح/خاطئ' : 'مختلط'}
- نوع المستخدم: ${userType === 'teacher' ? 'معلم (إضافة مفتاح إجابات وحلول)' : 'تلميذ (ممارسة وتدرب)'}`;

    // Get questions from the database (local questions bank)
    // This ensures questions are always from the curriculum
      // Get questions from the bank based on subject and difficulty
      let selectedQuestions = [];
      const subjectQuestions = questionsBank.questions_bank[subject];
      
      if (subjectQuestions) {
        // Get questions by difficulty level
        const difficultyQuestions = subjectQuestions[difficulty] || subjectQuestions.easy || [];
        
        // Shuffle and select the requested number of questions
        selectedQuestions = difficultyQuestions
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(questionCount, difficultyQuestions.length));
      }

      // If not enough questions in the bank, use AI to generate more (optional)
      if (selectedQuestions.length < questionCount) {
        console.log(`Only ${selectedQuestions.length} questions found for ${subject}, attempting to generate more...`);
      }

      // Build HTML for questions
      let questionsHtml = '';
      selectedQuestions.forEach((q, index) => {
        questionsHtml += `
          <div class="question-item">
            <p><strong>السؤال ${index + 1}:</strong> ${q.question}</p>
        `;
        
        if (q.type === 'mcq') {
          questionsHtml += '<div class="question-options">';
          q.options.forEach((option, optIndex) => {
            const isCorrect = option === q.correct ? 'correct' : '';
            questionsHtml += `<div class="option-item ${isCorrect}">
              <strong>${String.fromCharCode(97 + optIndex)}):</strong> ${option}
            </div>`;
          });
          questionsHtml += '</div>';
        }
        questionsHtml += '</div>';
      });

      // Add answer key for teachers
      let answerKeyHtml = '';
      if (includeAnswerKey && userType === 'teacher') {
        answerKeyHtml += '<h4>🔑 مفتاح الإجابات:</h4>';
        selectedQuestions.forEach((q, index) => {
          answerKeyHtml += `<p><strong>السؤال ${index + 1}:</strong> ${q.correct}</p>`;
        });
      }

      // Add solutions for teachers
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
    res.status(500).json({
      error: 'حدث خطأ في إنشاء الأسئلة',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve questions.html
app.get('/questions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'questions.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📚 Educational Platform for Algerian Secondary School');
  console.log('✅ Curriculum validation enabled');
  if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  Warning: GEMINI_API_KEY not set in .env file');
  }
});
