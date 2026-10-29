# Public portfolio

`index.php` reads projects, up to five ordered highlights, and profile data from MySQL. Visitors can browse the highlights slideshow, pause it, filter projects by category, load more projects, follow project links, and view profile/contact information. Navigation and a back-to-top control help move between sections; reduced-motion preferences affect animations and slideshow behavior.

Project order is stable within a visitor session and prioritizes projects with links. Highlights without entries show fallback content. Public data is maintained in [[docs/features/content-management]] and [[docs/features/media-library]].

**Verification:** implementation was inspected during feature mapping; public-page browser behavior was not retested in this task.
