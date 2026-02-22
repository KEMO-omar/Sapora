// 1. استيراد المكتبات الأساسية من سيرفرات جوجل
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    onChildAdded, 
    onChildRemoved, 
    remove, 
    onValue, 
    onDisconnect,
    update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. بيانات الاتصال الخاصة بمشروعك (هذه الإحداثيات تربط الكود بقاعدة بياناتك)
const firebaseConfig = {
    apiKey: "AIzaSyAVFNJhGIlOjyJgSGj9MqK4Xt89p_irSEQ",
    databaseURL: "https://sapora-f738b-default-rtdb.firebaseio.com",
    projectId: "sapora-f738b",
    appId: "1:6892834042:web:1993b52a61315ba5028d43"
};

// 3. تشغيل النظام وربط قاعدة البيانات
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 4. تصدير الأدوات عشان نستخدمها في ملف app.js
export { 
    db, 
    ref, 
    push, 
    set, 
    onChildAdded, 
    onChildRemoved, 
    remove, 
    onValue, 
    onDisconnect,
    update
};

/**
 * شرح بسيط لمحتوى الملف يا مستر:
 * - initializeApp: ده الأمر اللي بيفتح "خط التليفون" مع جوجل.
 * - getDatabase: ده اللي بيخلينا ندخل جوه "المخزن" عشان نطلع أو نحط بيانات.
 * - ref: ده "العنوان" أو "رقم الغرفة" اللي بنروح عندها (مثلاً عنوان غرفتك 101).
 * - push: ده اللي بيبعت "نقطة الرسم" أو "رسالة الشات" الجديدة.
 * - onValue: ده "المراقب" اللي بيفضل صاحي، أول ما طالب يدخل أو معلم يرسم، بيعرفنا فوراً.
 */
