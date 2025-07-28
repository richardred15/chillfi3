// Loader script to defer CSS/JS loading until service worker is ready
(function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
                return navigator.serviceWorker.ready;
            })
            .then(() => {
                console.log('Service Worker ready, loading resources...');
                loadResources();
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
                loadResources(); // Load anyway if SW fails
            });
    } else {
        loadResources();
    }

    function loadResources() {
        // Load CSS
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'client/css/main.css';
        document.head.appendChild(css);

        // Load main JS
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'client/js/app.js';
        document.head.appendChild(script);
    }
})();