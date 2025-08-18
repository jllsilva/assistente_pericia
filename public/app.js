async function sendMessage() {
    const message = document.getElementById("message").value.trim();
    const files = document.getElementById("file-input").files;

    const formData = new FormData();
    formData.append("prompt", message); // nome correto para o backend
    for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
    }

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            displayResponse("⚠️ Erro: " + error.error);
            return;
        }

        const data = await response.json();
        displayResponse(data.reply);
    } catch (err) {
        console.error(err);
        displayResponse("⚠️ Erro ao conectar com o servidor.");
    }
}

function displayResponse(text) {
    const chatBox = document.getElementById("chat-box");
    const messageElement = document.createElement("div");
    messageElement.classList.add("response");
    messageElement.textContent = text;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}
