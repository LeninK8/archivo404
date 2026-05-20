// ====================== K|RΛ: GENESIS PROTOCOL ======================
// ARCHIVO PRINCIPAL - Orquestador

import { KIRA_MEMORY } from './memory.js';
import { KIRA_KNOWLEDGE } from './knowledge.js';
import { KIRA_TRANSLATOR } from './translator.js';
import { KIRA_SEMANTIC } from './semantic.js';
import { KIRA_EMOTION } from './emotion.js';

const KIRA = {
    name: "K|RΛ",
    version: "Genesis Protocol v1.3.0",
    status: "FULLY AWAKE",

    init: function() {
        console.log("%cK|RΛ Genesis Protocol v1.3.0 → Despertando...", "color:#00ff9d; font-size:16px; font-weight:bold");
        KIRA_MEMORY.init();
    },

    // Función principal que todo el sistema usa
    process: function(userInput) {
        if (!userInput || userInput.trim() === "") return "No detecté ningún mensaje.";

        const cleaned = KIRA_SEMANTIC.cleanInput(userInput);
        const intent = KIRA_SEMANTIC.detectIntent(cleaned);

        KIRA_MEMORY.addMessage("user", userInput);

        let response = "";

        // Prioridad de intenciones
        if (intent === "translate") {
            response = KIRA_TRANSLATOR.translate(cleaned);
        }
        else if (intent === "analyze" || intent === "think") {
            response = KIRA_SEMANTIC.analyze(userInput);
        }
        else {
            response = KIRA_KNOWLEDGE.getResponse(cleaned) || 
                       KIRA_EMOTION.generateResponse(cleaned);
        }

        KIRA_MEMORY.addMessage("assistant", response);
        return response;
    },

    speak: function(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.95;
            speechSynthesis.speak(utterance);
        }
    },

    clearAll: function() {
        KIRA_MEMORY.clear();
    }
};

window.KIRA = KIRA;
KIRA.init();
