(function () {
  var p = location.pathname;
  if (p === '/login' || p.indexOf('/login') === 0) {
    document.documentElement.classList.add('route-login');
  }
})();
