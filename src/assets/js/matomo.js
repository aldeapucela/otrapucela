window._paq = window._paq || [];

window._paq.push(["trackPageView"]);
window._paq.push(["enableLinkTracking"]);

(function initializeMatomo() {
  const baseUrl = "//stats.aldeapucela.org/";

  window._paq.push(["setTrackerUrl", `${baseUrl}matomo.php`]);
  window._paq.push(["setSiteId", "21"]);

  const documentRef = window.document;
  const matomoScript = documentRef.createElement("script");
  const firstScript = documentRef.getElementsByTagName("script")[0];

  matomoScript.async = true;
  matomoScript.src = `${baseUrl}matomo.js`;

  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(matomoScript, firstScript);
    return;
  }

  documentRef.head.appendChild(matomoScript);
})();
