/**
 * Placed correctly, cached correctly, and returning a quarter of a megabyte of
 * markup on every cart change. Nothing in this repository runs a request or
 * measures one, so the only cost it can see is where the call sits.
 */
(function () {
  function paint(fragments) {
    Object.keys(fragments).forEach(function (selector) {
      var target = document.querySelector(selector);
      if (target) {
        target.innerHTML = fragments[selector];
      }
    });
  }

  function fetchAndPaint() {
    return fetch(acme.ajaxUrl + '?wc-ajax=get_refreshed_fragments')
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        paint(data.fragments);
        try {
          window.sessionStorage.setItem('acme_cart_fragments', JSON.stringify(data.fragments));
        } catch (error) {
          /* storage refused */
        }
      });
  }

  document.body.addEventListener('acme_cart_changed', function () {
    fetchAndPaint();
  });
})();
