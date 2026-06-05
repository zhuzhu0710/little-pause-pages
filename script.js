// Little Pause Pages - JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.use-case-card, .value-item, .faq-item, .sample-item, .reason-item, .step').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

const requestConfirmation = document.getElementById('requestConfirmation');
const requestState = new URLSearchParams(window.location.search).get('free-pdf');

if (requestConfirmation && requestState === 'sent') {
    requestConfirmation.hidden = false;
    requestConfirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const freeSampleForm = document.querySelector('form[name="free-sample-request"]');

if (freeSampleForm) {
    freeSampleForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const formData = new FormData(freeSampleForm);
        const encoded = new URLSearchParams(formData).toString();
        const submitButton = freeSampleForm.querySelector('.signup-button');
        const confirmation = document.getElementById('requestConfirmation');

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
        }

        try {
            await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: encoded
            });

            freeSampleForm.reset();

            if (confirmation) {
                confirmation.hidden = false;
                confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Send My Free PDF';
            }
        } catch (error) {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Send My Free PDF';
            }
            alert('Sorry, we could not send your request right now. Please try again or email us directly.');
        }
    });
}
