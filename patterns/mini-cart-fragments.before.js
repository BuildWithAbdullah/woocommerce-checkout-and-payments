/**
 * Keeping the mini cart up to date.
 */
(function () {
  function refreshFragments() {
    return fetch(acme.ajaxUrl + '?wc-ajax=get_refreshed_fragments')
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        var target = document.querySelector('.widget_shopping_cart_content');
        if (target) {
          target.innerHTML = data.fragments['div.widget_shopping_cart_content'];
        }
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    refreshFragments();
  });

  window.addEventListener('scroll', function () {
    refreshFragments();
  });

  document.body.addEventListener('acme_cart_changed', function () {
    refreshFragments();
  });
})();
