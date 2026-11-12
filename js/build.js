/* Build stamp. CI overwrites this file in the app bundle with the real run number, commit and branch. */
window.BUILD={n:0,sha:"dev",branch:"local"};
window.buildLabel=function(){var b=window.BUILD||{};return"Build "+b.n+" \u00B7 "+b.sha+" \u00B7 "+b.branch};
