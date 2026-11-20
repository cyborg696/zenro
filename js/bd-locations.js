/** The 64 districts of Bangladesh, grouped by division (used by checkout and order validation). */
'use strict';

const BD_DIVISIONS = Object.freeze([
  { name: 'Barishal', districts: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'] },
  { name: 'Chattogram', districts: ['Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', "Cox's Bazar", 'Cumilla', 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'] },
  { name: 'Dhaka', districts: ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'] },
  { name: 'Khulna', districts: ['Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'] },
  { name: 'Mymensingh', districts: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'] },
  { name: 'Rajshahi', districts: ['Bogura', 'Chapai Nawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'] },
  { name: 'Rangpur', districts: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'] },
  { name: 'Sylhet', districts: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'] },
].map((d) => Object.freeze({ ...d, districts: Object.freeze(d.districts) })));

/** Flat list of district names (64). */
const BD_DISTRICTS = Object.freeze(BD_DIVISIONS.flatMap((d) => d.districts));

/** Districts whose orders default to the "Inside Dhaka" delivery zone (the customer can change it). */
const BD_INSIDE_DHAKA_DISTRICTS = Object.freeze(['Dhaka']);
