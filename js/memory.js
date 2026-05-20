export const KIRA_MEMORY = {
    memory: [],
    maxSize: 60,

    init: function() {
        this.memory = JSON.parse(localStorage.getItem('kira_memory')) || [];
    },

    addMessage: function(role, content) {
        this.memory.push({
            role: role,
            content: content,
            time: new Date().toLocaleTimeString()
        });

        if (this.memory.length > this.maxSize) this.memory.shift();
        localStorage.setItem('kira_memory', JSON.stringify(this.memory));
    },

    getHistory: function() {
        return this.memory;
    },

    clear: function() {
        this.memory = [];
        localStorage.removeItem('kira_memory');
        console.log("%c[K|RΛ] Memoria borrada completamente.", "color:#ff00ff");
    }
};
