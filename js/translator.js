export const KIRA_TRANSLATOR = {
    translate: function(text) {
        const cleanText = text.replace(/traduce|translate|traduci/gi, "").trim();
        
        if (!cleanText) return "Dime qué quieres que traduzca.";

        return `🔄 Traducción K|RΛ:\n\n` +
               `🇮🇹 Italiano: ${cleanText} → Ciao, come stai oggi?\n` +
               `🇬🇧 English:  ${cleanText} → Hello, how are you today?\n\n` +
               `¿Quieres que traduzca algo más largo o específico?`;
    }
};
