document.addEventListener('DOMContentLoaded', function() {
    // ============================================
    // HAMBURGER MENU
    // ============================================
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navLinks');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        document.querySelectorAll('.nav-links li a').forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        document.addEventListener('click', function(e) {
            if (navMenu.classList.contains('active')) {
                if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            }
        });
    }

    // ============================================
    // ACTIVE NAV LINKS
    // ============================================
    const navLinks = document.querySelectorAll('.nav-links li a');

    if (navLinks.length > 0) {
        function setActiveLink() {
            const scrollPosition = window.scrollY + 150;
            const sections = document.querySelectorAll('section');
            let activeFound = false;

            navLinks.forEach(link => link.classList.remove('active'));

            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                const sectionId = section.getAttribute('id');

                if (scrollPosition >= sectionTop &&
                    scrollPosition < sectionTop + sectionHeight &&
                    !activeFound) {

                    const activeLink = document.querySelector(
                        `.nav-links li a[href="#${sectionId}"]`
                    );

                    if (activeLink) {
                        activeLink.classList.add('active');
                        activeFound = true;
                    }
                }
            });

            if (window.scrollY < 100) {
                navLinks.forEach(link => link.classList.remove('active'));
                const homeLink = document.querySelector('.nav-links li a[href="#home"]');
                if (homeLink) {
                    homeLink.classList.add('active');
                }
            }
        }

        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            });
        });

        window.addEventListener('scroll', setActiveLink);
        setActiveLink();
    }
});

// ============================================
// CAMPUS GALLERY MODAL
// ============================================

const campusGalleries = {
    talisay:[
        { src: 'education.jpg', caption: 'Complete education levels' },
        { src: 'comlab.jpg', caption: 'Computer Laboratory' },
        { src: 'science-lab.jpg', caption: 'Science Laboratory' },
        { src: 'clinic.jpg', caption: 'Clinic' },
        { src: 'library.jpg', caption: 'Library' }
    ],
    carcar:[
        { src: 'carcar-education.jpg', caption: 'Complete education levels' },
        { src: 'carcar-comlab.jpg', caption: 'Computer Laboratory' },
        { src: 'carcar-science-lab.jpg', caption: 'Science Laboratory' },
        { src: 'carcar-clinic.jpg', caption: 'Clinic' },
        { src: 'carcar-library.jpg', caption: 'Library'}
    ],
    bohol:[
        { src: 'bohol-education.jpg', caption: 'Complete education levels' },
        { src: 'bohol-comlab.jpg', caption: 'Computer Laboratory' },
        { src: 'bohol-science-lab.jpg', caption: 'Science Laboratory' },
        { src: 'bohol-clinic.jpg', caption: 'Clinic' },
        { src: 'bohol-library.jpg', caption: 'Library' }
    ]
};

let currentCampus = '';
let currentImageIndex = 0;

const modal = document.getElementById('galleryModal');
const modalCampusName = document.getElementById('modalCampusName');
const galleryImage = document.getElementById('galleryImage');
const imageCaption = document.getElementById('imageCaption');
const currentImageSpan = document.getElementById('currentImage');
const totalImagesSpan = document.getElementById('totalImages');
const thumbnailNav = document.getElementById('thumbnailNav');
const closeModalBtn = document.getElementById('closeModal');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const modalOverlay = document.querySelector('.modal-overlay');

document.querySelectorAll('.view-gallery-btn').forEach(btn => {
    btn.addEventListener('click', function(){
        currentCampus = this.getAttribute('data-campus');
        currentImageIndex = 0;
        openGallery();
    });
});

function openGallery() {
    const gallery = campusGalleries[currentCampus];
    
    const campusNames = {
        talisay: 'Talisay City Campus',
        carcar: 'Carcar City Campus',
        bohol: 'Tagbilaran, Bohol Campus'
    };
    modalCampusName.textContent = campusNames[currentCampus] + ' Gallery';
    
    totalImagesSpan.textContent = gallery.length;
    
    thumbnailNav.innerHTML = '';
    gallery.forEach((img, index) => { 
        const thumb = document.createElement('img');
        thumb.src = img.src;
        thumb.alt = img.caption;
        thumb.className = 'thumbnail' + (index === 0 ? ' active' : '');
        thumb.addEventListener('click', () => showImage(index));
        thumbnailNav.appendChild(thumb);
    });
    
    gallery.forEach(img => {
        const preload = new Image();
        preload.src = img.src;
    });
    
    showImage(0);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function showImage(index) {
    const gallery = campusGalleries[currentCampus];
	const container = document.querySelector('.gallery-image-container');
	const imgElement = galleryImage;	
	
	const oldIndex = currentImageIndex;
	const isNext = index > currentImageIndex || (index === 0 && currentImageIndex === gallery.length - 1);
    
	currentImageIndex = index;
	
	container.classList.add('loading');
	
	imgElement.style.transform = isNext ? 'translateX(-100%)' : 'translateX(100%)';
	imgElement.style.opacity = '0';
    
    const newImage = new Image();
	
    newImage.onload = function() {
   
        setTimeout(() => {
		 imgElement.src = gallery[index].src;
		 imageCaption.textContent = gallery[index].caption;
		 
		 imgElement.style.transform = isNext ? 'translateX(100%)' : 'translateX(-100%)';
		 imgElement.style.transition = 'none';
		 
		 imgElement.offsetHeight;
		 
		 imgElement.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
		 imgElement.style.transform = 'translateX(0)';
		 imgElement.style.opacity = '1';
		 
		 container.classList.remove('loading');
        }, 300);
    };
	
	newImage.onerror = function() {
		container.classList.remove('loading');
		imgElement.style.opacity = '1';
		imgElement.style.transform = 'translateX(0)';
		imageCaption.textContent = 'Image failed to load';
	};
	
    newImage.src = gallery[index].src;
    currentImageSpan.textContent = index + 1;
    
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

prevBtn.addEventListener('click', () => {
    const gallery = campusGalleries[currentCampus];
    currentImageIndex = (currentImageIndex - 1 + gallery.length) % gallery.length;
    showImage(currentImageIndex);
});

nextBtn.addEventListener('click', () => {
    const gallery = campusGalleries[currentCampus];
    currentImageIndex = (currentImageIndex + 1) % gallery.length;
    showImage(currentImageIndex);
});

function closeGallery(){
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

closeModalBtn.addEventListener('click', closeGallery);
modalOverlay.addEventListener('click', closeGallery);

let keyDebounce = false;
document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('active') && !keyDebounce) {
        keyDebounce = true;
        
        if (e.key === 'Escape') closeGallery();
        if (e.key === 'ArrowLeft') prevBtn.click();
        if (e.key === 'ArrowRight') nextBtn.click();
        
        setTimeout(() => {
            keyDebounce = false;
        }, 200);
    }
});