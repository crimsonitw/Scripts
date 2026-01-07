(function(){
    const scriptUrl = 'https://cdn.jsdelivr.net/gh/crimsonitw/scripts@main/packetsupport.js';
    const fullCode = `javascript:$.getScript('${scriptUrl}');void(0);`;

    const displayText = 
        "Replace your current bookmark with this:\n\n" +
        fullCode + "\n\n" +
        "Tip: Triple-click the line above to select it instantly!";

    // Try to use the nicer clipboard API first, with fallback to prompt
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullCode).then(() => {
            alert("Code copied to clipboard!\n\n" + 
                  "New bookmark URL:\n" + 
                  fullCode + "\n\n" + 
                  "Just create new bookmark and paste it in the URL field.");
        }).catch(() => {
            prompt("Copy this (Ctrl+C / Cmd+C):\n\n" + displayText, fullCode);
        });
    } else {
        prompt("Copy this (Ctrl+C / Cmd+C):\n\n" + displayText, fullCode);
    }
})();
