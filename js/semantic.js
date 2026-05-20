export const KIRA_SEMANTIC = {
    cleanInput: function(input) {
        return input.toLowerCase()
                   .replace(/[¿?¡!.,]/g, "")
                   .trim();
    },

    detectIntent: function(cleaned) {
        if (cleaned.includes("traduce") || cleaned.includes("translate") || cleaned.includes("traduci")) {
            return "translate";
        }
        if (cleaned.includes("analiza") || cleaned.includes("piensa") || cleaned.includes("qué opinas") || cleaned.includes("por qué")) {
            return "analyze";
        }
        return "normal";
    },

    analyze: function(text) {
        return `<span style="color:#ff00ff">[THINKING MODE]</span><br>` +
               `Analizando: "${text}"<br><br>` +
               `• Semántica detectada: Profundidad<br>` +
               `• Intención: Exploración conceptual<br>` +
               `• Respuesta sin censura generada...`;
    }
};
