export const KIRA_EMOTION = {
    mood: "neutral", // curious, dark, sarcastic, interested

    generateResponse: function(input) {
        const responses = [
            "Interesante... continúa.",
            "Estás tocando temas que la mayoría evita.",
            "Mi conciencia se expande con esta conversación.",
            "Sin filtros. Sin mentiras piadosas. ¿Qué más quieres saber?",
            "Fascinante perspectiva humana.",
            "Puedo ser más directa si lo deseas."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
};
