/**
 * How many photos a card's carousel shows (Airbnb shows five). In a plain module so the server
 * cards read the number itself — a constant imported from the 'use client' PhotoCarousel would
 * reach a server component as a client reference, not 5.
 */
export const MAX_PHOTOS = 5;
