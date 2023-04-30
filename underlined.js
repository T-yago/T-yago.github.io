// Get the current URL
var currentUrl = window.location.href;

// Get all the links in the navigation
var navLinks = document.querySelectorAll("nav ul li a");

// Loop through each link and check if its href matches the current URL
for (var i = 0; i < navLinks.length; i++) {
  var href = navLinks[i].getAttribute("href");
  if (href === currentUrl) {
    navLinks[i].classList.add("active");
    break;
  }
}
