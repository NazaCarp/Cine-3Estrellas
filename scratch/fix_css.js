
import fs from 'fs';
const filePath = "c:\\Users\\NazaCarp\\OneDrive\\Documentos\\Programación\\Cine-3Estrellas - Final Version (Soporte para TV & Android)\\src\\app\\globals.css";
let content = fs.readFileSync(filePath, 'utf8');

// Fix detail-content padding
content = content.replace(/padding: clamp\(60px, 12vh, 120px\) clamp\(40px, 8vw, 100px\) clamp\(40px, 8vh, 80px\);/, "padding: 60px 20px 40px;");

// Fix similar-track-wrapper margins/padding
content = content.replace(/margin: 0 -40px;\n  padding: 20px 40px;/, "margin: 0 -20px;\n  padding: 20px 20px;");

fs.writeFileSync(filePath, content);
console.log("Fixed!");
