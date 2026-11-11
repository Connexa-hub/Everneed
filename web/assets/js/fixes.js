/* Small fixes loaded last. */
(function(){var V=Core.V,op=V.portal;V.portal=function(p){var me=Core.me();if(me&&me.role==="admin")return{redirect:"#/admin"};return op(p)}})();
