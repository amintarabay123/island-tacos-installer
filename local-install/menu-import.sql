-- Island Tacos Menu Import
-- Run with: psql -U ituser -d islandtacos -f menu-import.sql
SET client_encoding = 'UTF8';

-- Categories
INSERT INTO menu_categories (id, name, description, sort_order, loyverse_id, send_to_kds, icon) VALUES
(21, 'Tacos', NULL, 0, '985ebc52-71b4-11ea-8d93-0603130a05b8', true, '🌮'),
(22, 'Misc', NULL, 0, NULL, true, '❓'),
(23, 'MISC', NULL, 0, NULL, true, '⁉️'),
(24, 'MISC', NULL, 0, NULL, true, '⁉️'),
(25, 'MISC', NULL, 0, NULL, true, '⁉️'),
(26, 'Misc', NULL, 0, NULL, true, '⁉️'),
(7, 'Wings', NULL, 1, '5e2b52b4-9b5e-4233-b61d-e5070a67fad2', true, NULL),
(8, 'Special', NULL, 2, 'ab13f8a7-2acb-43fe-ad9b-064dabdf305d', true, NULL),
(10, 'Specials', NULL, 4, 'de7a435b-91f4-4107-a735-a088b7e7fb8a', true, NULL),
(14, 'Chili', NULL, 8, '9b26e606-71b4-11ea-8d93-0603130a05b8', true, NULL),
(20, 'Burritos', NULL, 10, '985ebcd0-71b4-11ea-8d93-0603130a05b8', true, '🌯'),
(19, 'Quesadilla', NULL, 20, '985ebce6-71b4-11ea-8d93-0603130a05b8', true, '🧇'),
(18, 'Rice Bowl', NULL, 30, '985ebd64-71b4-11ea-8d93-0603130a05b8', true, '🍛'),
(16, 'Salads', NULL, 40, '98fdaa86-71b4-11ea-8d93-0603130a05b8', true, '🥗'),
(9, 'Potato Bowls', NULL, 50, '96e29da6-a48e-4425-947e-b16eb9856acb', true, NULL),
(6, 'Fried Rice', NULL, 60, 'cad8c306-8dad-48d3-8b73-ef0ed75fdefd', true, '🫕'),
(13, 'Kids', NULL, 70, 'ca8cf446-2800-47d1-ba18-c0643ca4502d', true, '👶🏼'),
(11, 'Sides', NULL, 80, '666ec17a-1abd-4592-9810-65bbd5bcdcbc', true, '🍟'),
(12, 'Burgers', NULL, 90, 'e57ae7bb-cd18-4e7c-b3fb-e8c0e82af9d7', true, '🍔'),
(15, 'Nachos', NULL, 100, '9b26e5eb-71b4-11ea-8d93-0603130a05b8', true, NULL),
(17, 'Drinks', NULL, 110, '985f4278-71b4-11ea-8d93-0603130a05b8', false, '🥤')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  loyverse_id = EXCLUDED.loyverse_id,
  send_to_kds = EXCLUDED.send_to_kds,
  icon = EXCLUDED.icon;

SELECT setval('menu_categories_id_seq', (SELECT MAX(id) FROM menu_categories));

-- Menu Items
INSERT INTO menu_items (id, name, description, price, category_id, available, popular, spicy, vegetarian, image_url, pos_image_url, sort_order, loyverse_item_id, loyverse_variant_id) VALUES
(68, 'Taco Salmon 🐟', 'Two soft shell tortilla stuffed with salmoni, with fresh pico, corn, cabbage and guacamole.', 20.00, 21, true, false, false, false, '/api/storage/objects/uploads/29840448-0b96-4ed3-89dd-efa375ae731c', '/api/storage/objects/uploads/72db41b0-7b08-4cae-8ce3-cc805a5d84fa', 30, 'e15db5a8-8c82-4d2c-905d-57df763e5fca', '20b8eebe-c637-4886-9e6a-3a21d443ff43'),
(69, 'Taco Shrimp 🍤', 'Two soft shell tortilla stuffed with shrimp, with fresh pico, corn, cabbage and guacamole.', 18.00, 21, true, false, false, false, '/api/storage/objects/uploads/3ec62eb8-655f-4f84-931b-0f50ecc881a1', '/api/storage/objects/uploads/6caf2189-a038-46d4-917c-61d2ad76471f', 20, '845ad1f2-5de1-4a38-952b-1f2ac44a38c9', 'ab9e6734-8835-4ad9-8880-687638f265b6'),
(70, 'Taco Veggie 🥗', 'Two soft shell tortilla stuffed with grilled veggies(bells peppers, onions and zucchini, with fresh pico, corn, cabbage and guacamole.', 12.00, 21, true, false, false, true, '/api/storage/objects/uploads/ead6d495-6095-4a34-9766-345043295898', '/api/storage/objects/uploads/82d48455-3c09-444c-8459-6e02bcd31b1d', 40, 'ec0b1c2f-e73b-4301-a427-6e194ffe30da', 'd6ebbae6-7ea6-4386-bcec-598463a1e65d'),
(71, 'Tacos Steak 🥩', 'Two soft shell tortillas stuffed with grilled steak chunks and fresh toppings like pico, cabbage, corn and guacamole. with house sauce', 16.00, 21, true, false, false, false, '/api/storage/objects/uploads/c0c90053-a641-48a0-921e-092c3265a5f1', 'https://api.loyverse.com/image/707890c3-679c-40b0-8b90-b79c92c9b72e', 10, '707890c3-679c-40b0-8b90-b79c92c9b72e', '2ba0a908-95ab-4e11-b760-9f30fa774eda'),
(74, 'Tacos Chicken 🍗', 'Two soft shell tortillas stuffed with grilled chicken and fresh toppings like pico de Gallo, corn, cabbage and guacamole with house sauce.', 14.00, 21, true, true, false, false, '/api/storage/objects/uploads/1ae4d269-5e0d-49ea-9e03-71d84a852bbf', '/api/storage/objects/uploads/051429c6-11df-4955-9c33-9f4439f3a1f2', 0, '4135fa14-6b8c-4381-9173-e04fe799cbab', '6050307d-0c3c-49e2-b905-d65c72f06e0e'),
(75, 'Nachos Steak', NULL, 14.00, 15, true, false, false, false, 'https://api.loyverse.com/image/0d126651-bdf0-410d-8e03-7c9950c2d1b1', NULL, 460, '0d126651-bdf0-410d-8e03-7c9950c2d1b1', '88e2dea7-63c8-4d48-a9e8-18fca87a567c'),
(76, 'Nachos Chicken', 'Crsipy Nachos topped with grilled chicken breast along with a variety of fresh toppings.', 12.00, 15, true, false, false, false, 'https://api.loyverse.com/image/46a77aba-7865-431b-8842-ee5705ca543d', NULL, 450, '46a77aba-7865-431b-8842-ee5705ca543d', '6e49dede-b0f9-47a3-be67-fa3b29efc13e'),
(77, 'Fried Rice Veggie', 'Rice stir fried with veggies with Mexican seasoning.', 14.00, 6, true, false, false, true, '/api/storage/objects/uploads/84ad75c4-bd2b-4002-8db6-14af3de442ed', '/api/storage/objects/uploads/59bb480e-4d40-4fba-8de9-1cc96f907042', 330, 'fbe9f09b-9871-4360-b6ac-4c9a9b2227f9', 'f9aec277-461c-4847-b17b-5edb4c124c91'),
(78, 'Fried Rice Shrimp', 'Rice stir fried with shrimp and veggies with Mexican seasoning.', 20.00, 6, true, false, false, false, '/api/storage/objects/uploads/e5cabfa4-9d5e-403b-94c5-0d0c69f9da05', '/api/storage/objects/uploads/cea0dfd9-5edd-4f2c-ac67-2878e8a9e85f', 340, '56ec2e28-93cb-4b50-8e76-5de9624e9627', '8daecc78-9f07-421a-8134-5c6cb79dcc28'),
(79, 'Fried Rice Steak', 'Rice stir fried with steak and veggies with Mexican seasoning.', 18.00, 6, true, false, false, false, '/api/storage/objects/uploads/6e292a5e-2647-44eb-bdd2-a6e883171610', '/api/storage/objects/uploads/d09ff04d-3856-4ccb-ade0-1df16066061c', 320, '130c24ed-238b-4384-a157-c4d57e291a49', '5ee777d7-12f1-4635-bce1-c5e6d97855e8'),
(80, 'Fried Rice Chicken', 'Rice stir fried with chicken and veggies with Mexican seasoning.', 16.00, 6, true, false, false, false, '/api/storage/objects/uploads/506be5e3-06a4-4d1d-9706-b48ed1c87e25', '/api/storage/objects/uploads/3cedef11-a14b-40a4-ac43-b0222220f001', 310, '759a1c9f-067c-47dc-a1f6-6763dd4e6fe2', '392f2ed6-8020-4c66-b24a-1edacf90166d'),
(81, 'Quesadilla Cheese', NULL, 9.99, 19, true, false, false, false, '/api/storage/objects/uploads/2d76c31d-c3a7-43a2-9c07-3c91299baeba', '/api/storage/objects/uploads/5c2a2888-fb58-4c6e-8106-d52b3ffa995a', 50, 'ac2d027e-b1f6-441c-a558-5428f3a000dc', '51791c0f-cfa4-46bf-8141-db0f96ef8f85'),
(82, 'Island Taco Chicken Burger', 'Grilled 100% chicken breast with cheese, tomato, lettuce, jalapeños, guacamole and our house sauce.', 12.00, 12, true, false, false, false, '/api/storage/objects/uploads/0f88a104-49fc-45d1-b763-315bf0e7468a', '/api/storage/objects/uploads/889016c3-30a4-40d9-bb90-eb06bea78612', 350, 'd8a201e1-b6bc-46f8-9469-0f2f08e4a712', '7c3a5d52-049d-4c0a-95df-086fa524c534'),
(83, 'Potato Bowl Veggies 🥗', 'Seasoned fries covered in our fresh toppings, grilled veggies and our house chipotle sauce.', 14.00, 9, true, false, false, true, '/api/storage/objects/uploads/3ab7a670-aad6-4dd7-a19e-bda3cc068ede', '/api/storage/objects/uploads/49ea333a-77ea-49b3-8603-af99f6c2af90', 300, '775b3128-d08d-4f5c-8e14-be75a3d03ac2', '645f01e9-5c22-4a60-b6ab-54ef1fc48a2b'),
(84, 'Potato Bowl Salmon 🐟', 'Seasoned fries covered in our fresh toppings, grilled salmon and our house chipotle sauce.', 22.00, 9, true, false, false, false, '/api/storage/objects/uploads/f7f96556-06df-41bf-8028-237bed5b9aad', '/api/storage/objects/uploads/1c7ec706-0fb4-4b67-a433-cdb9f33e4ca1', 290, 'c993881c-8277-4c1a-a46a-d319f81c4d1a', 'd6ecf9d6-7207-461f-8eb3-977e62a3f5ff'),
(85, 'Potato Bowl Shrimp 🍤', 'Seasoned fries covered in our fresh toppings, grilled shrimp and our house chipotle sauce.', 20.00, 9, true, false, false, false, '/api/storage/objects/uploads/c6a38913-f4b4-459d-890e-4d49c7fa80b3', '/api/storage/objects/uploads/fe0a399d-90a6-42c6-be6a-a75bb6b6d387', 280, '7a418594-3cc2-489b-b445-ff17460aafef', '4ff5d77a-fd20-42a4-91ca-b90b1ef462e1'),
(86, 'Potato Bowl Steak 🥩', 'Seasoned fries covered in our fresh toppings, grilled steak and our house chipotle sauce.', 18.00, 9, true, false, false, false, '/api/storage/objects/uploads/b8735e1e-6e16-4a0b-b144-130b2d763fdf', '/api/storage/objects/uploads/754cbc2a-ba9e-4fbd-8c90-10cdd6944ee7', 270, 'f3789aac-099d-4437-a1af-61e2abb0d4bb', '6ab4c95b-280e-405b-8a71-bc7509d8516f'),
(87, 'Potato Bowl Chicken 🍗', 'Seasoned fries covered in our fresh toppings, grilled chicken and our house chipotle sauce.', 16.00, 9, true, false, false, false, '/api/storage/objects/uploads/b3f3dc63-4532-4898-9710-8494a049f563', '/api/storage/objects/uploads/5fded5de-f8ab-4d3c-bdcb-cd25fea26e8d', 260, '63ff6440-a5e0-42bf-8601-8cce3110d996', '20a9c621-a9c5-4408-8d8f-b6ce6c65a485'),
(88, 'Fries', 'Straight cut fries', 5.00, 11, true, false, false, false, '/api/storage/objects/uploads/2326bbd9-abca-4624-9dee-661c4ec0ea44', '/api/storage/objects/uploads/43e9e995-c8ae-4d36-b34b-ec8da396583e', 410, 'b843630a-c191-4684-a7ff-464eda16682e', '042bb448-7898-46aa-97f3-22a5642cbeba'),
(89, 'Island Taco Burger', '8oz Angus Beef, Lettuce, Tomato, Jalapeños, PepperJack Cheese, Guacamole, Chipotle Sauce.', 12.00, 12, true, false, false, false, '/api/storage/objects/uploads/6524188b-eb50-4cb9-bebb-390f1bfda586', '/api/storage/objects/uploads/bcb0f0cc-46e2-4f6d-835e-185f9fa40402', 360, '13d52dcb-92ca-4ada-a241-18e7aef1bd49', '5113ce27-29f3-40b1-b9f6-f9c2413d6e50'),
(90, 'Mini Steak Quesadilla 🥩', 'Mini steak quesadilla with two toppings.', 9.99, 13, true, false, false, false, '/api/storage/objects/uploads/0e258589-e5f3-4f6f-8b10-cbdcd2cb23cb', '/api/storage/objects/uploads/352ee62a-c287-4025-9651-a78de3b3e12a', 370, '754cdf62-f7e4-4280-ac69-8d8905f17a8f', '7e2cf570-926c-4f02-89c9-7de4729026e7'),
(91, 'Mini Chicken Quesadilla 🍗', 'Mini chicken quesadillas with two toppings of choice.', 8.99, 13, true, false, false, false, '/api/storage/objects/uploads/8d6aa45d-fea7-4ef6-bfbd-318770e7a20b', '/api/storage/objects/uploads/1e3012cf-fa76-4003-ab5e-b130aac8ecb7', 380, '5b48729e-0265-44f8-b7d6-49d6b2248a06', '474485a9-706b-41b9-9925-3b1316a29c72'),
(92, 'Kids Steak Rice Bowl 🥩', 'Grilled Beef Steak & White Rice with choice of 2 toppings.', 9.99, 13, true, false, false, false, '/api/storage/objects/uploads/589da34f-7120-4b03-ad94-57369d514e5a', '/api/storage/objects/uploads/ecf44809-410b-4908-956c-7d37ad28dd97', 390, '556dd598-fdea-4640-a1a2-c3e4060b4672', 'e8b8a14f-55bc-44e1-b237-226bc6d78adc'),
(93, 'Kids Chicken Rice Bowl 🍗', 'Grilled Chicken & White Rice with your choice of 2 toppings.', 8.99, 13, true, false, false, false, '/api/storage/objects/uploads/0650daee-f035-4fb9-9d8e-6066ad0feae6', '/api/storage/objects/uploads/10a845cb-9911-4037-b21b-a97b8e94f578', 400, '42268d18-31a5-4807-8c15-217d8e271141', '8ababf00-ae82-43fc-86d3-e1317fa958e8'),
(94, 'Quesadilla Salmon 🐟', NULL, 20.00, 19, true, false, false, false, '/api/storage/objects/uploads/0fac265c-b320-41ff-b3a2-d67236901034', '/api/storage/objects/uploads/24243ed4-7a7a-406c-a3f1-e95d2bd5dfd4', 90, 'cfb0ceee-cc3a-4e1d-837f-2925776363eb', 'cd2d2aec-2b0c-4e44-94bc-95188d8f7cf7'),
(95, 'Burrito Salmon 🐟', 'Grilled Salmon rolled in a toasted flour tortilla with guac, salsa, cheese and chipotle sauce.', 20.00, 20, true, false, false, false, '/api/storage/objects/uploads/72873698-c37a-4d61-ac26-51f67ad363d3', '/api/storage/objects/uploads/aa779467-d65d-43c5-9460-ce463e5ef29c', 140, 'b9731994-3342-43dc-bf9b-8c4db02be883', 'b8f35344-99f5-46ec-b4a2-5468f5089a47'),
(96, 'Burrito Chicken 🍗', 'Grilled Chicken Breast in a12 inch flour tortilla with cheese, corn, salsa, rice, black beans, guacamole with our house sauce wrapped tight.', 14.00, 20, true, false, false, false, '/api/storage/objects/uploads/e6c3312f-a001-4601-aecb-a85a2a9c8d92', '/api/storage/objects/uploads/0b4a7f9e-34d1-48f0-979a-3e00fc7bc4c7', 110, '5fab96cf-cbe6-4de4-b40d-4aafc2b10a6c', 'c105c5fb-559f-4fc0-bfa4-09d6c05572c6'),
(97, 'Bottle Juices 🥤', NULL, 3.00, 17, true, false, false, false, '/api/storage/objects/uploads/919a29ca-6b1d-4e42-9a40-5c07bc142795', '/api/storage/objects/uploads/dee3be60-39fa-4497-9149-f467b40cf270', 420, '53e40d25-9ab4-4910-bcf0-1fba894dc106', 'd32d1fcc-81a4-46c9-ac48-8e11b178b22c'),
(98, 'Salad Salmon 🐟', NULL, 22.00, 16, true, false, false, false, '/api/storage/objects/uploads/1b251703-dd66-44ed-b1c5-1c366c9e05e5', '/api/storage/objects/uploads/2a6b300e-9b72-4e85-9d5a-0cdc979e46b6', 240, '0a368692-7120-11ea-8d93-0603130a05b8', 'ed80764a-71ab-11ea-8d93-0603130a05b8'),
(99, 'Rice Bowl Salmon 🐟', NULL, 22.00, 18, true, false, false, false, '/api/storage/objects/uploads/6a9f37fb-3da7-4a90-9f05-925bf3b571c8', '/api/storage/objects/uploads/a395e98b-227f-4041-885d-b2759e74b3ea', 190, '08032392-7120-11ea-8d93-0603130a05b8', 'e7b7d434-71ab-11ea-8d93-0603130a05b8'),
(100, 'Salad Veggie 🥗', NULL, 14.00, 16, true, false, false, true, '/api/storage/objects/uploads/fe7ee95c-5873-4d07-b8d0-02129248673b', '/api/storage/objects/uploads/d6c940a8-0e40-4559-a3f6-44ca1f8ccd75', 250, 'd10a7dd5-711e-11ea-8d93-0603130a05b8', 'bd892967-71a9-11ea-8d93-0603130a05b8'),
(101, 'Quesadilla Veggie 🥗', NULL, 12.00, 19, true, false, false, true, '/api/storage/objects/uploads/a1c1424d-46a1-4c1d-a1ad-34d56be14683', '/api/storage/objects/uploads/de3d362e-5968-4961-a4e5-ea976d065892', 100, 'd10755c0-711e-11ea-8d93-0603130a05b8', 'bd87ed39-71a9-11ea-8d93-0603130a05b8'),
(102, 'Salad Shrimp 🍤', NULL, 20.00, 16, true, false, false, false, '/api/storage/objects/uploads/2ac988ca-d5dc-4086-a568-62b7a2d64697', '/api/storage/objects/uploads/8b6d40ef-834b-4c96-8a49-41187f9f199b', 230, 'd106d1ce-711e-11ea-8d93-0603130a05b8', 'edc8b845-71ab-11ea-8d93-0603130a05b8'),
(103, 'Salad Steak 🥩', NULL, 18.00, 16, true, false, false, false, '/api/storage/objects/uploads/6dca4215-900a-4662-bc75-3f63b8db4312', '/api/storage/objects/uploads/9a126fce-d95b-4d0b-896c-e8d462e0658d', 220, 'd106cf38-711e-11ea-8d93-0603130a05b8', 'bd87c1bc-71a9-11ea-8d93-0603130a05b8'),
(104, 'Salad Chicken 🍗', NULL, 16.00, 16, true, false, false, false, '/api/storage/objects/uploads/b90f9e32-c854-496f-8992-9bf00aff0841', '/api/storage/objects/uploads/4dedb1ff-d0d3-458a-ba11-5d430409fb67', 210, 'd106c944-711e-11ea-8d93-0603130a05b8', 'bd87bf45-71a9-11ea-8d93-0603130a05b8'),
(105, 'Burrito Veggie 🥗', 'Grilled Veggies in a12 inch flour tortilla with cheese, corn, salsa, rice, black beans, guacamole with our house sauce wrapped tight.', 12.00, 20, true, false, false, true, '/api/storage/objects/uploads/f810dab6-1335-490b-afa4-f3f14078b701', '/api/storage/objects/uploads/1a9ec796-71e0-432e-b979-7be321a49152', 150, 'b0be6472-711e-11ea-8d93-0603130a05b8', 'abcce8d3-71a9-11ea-8d93-0603130a05b8'),
(106, 'wMisc ❓', NULL, 0.00, 6, true, false, false, false, 'https://api.loyverse.com/image/ab9ddd6b-711e-11ea-8d93-0603130a05b8', NULL, 470, 'ab9ddd6b-711e-11ea-8d93-0603130a05b8', 'a7160c0b-71a9-11ea-8d93-0603130a05b8'),
(107, 'Rice Bowl Veggie 🥗', NULL, 14.00, 18, true, false, false, true, '/api/storage/objects/uploads/e1d8a2ac-24be-4c38-9c92-dfb97ee1c521', '/api/storage/objects/uploads/2517a0e5-de76-496a-9a5c-2faef6962d59', 200, 'aa009183-711e-11ea-8d93-0603130a05b8', 'a513c283-71a9-11ea-8d93-0603130a05b8'),
(108, 'xSoda/Juice 🥤', NULL, 2.00, 17, true, false, false, false, '/api/storage/objects/uploads/53fb88ad-7b55-4966-8c06-331cbdefe083', '/api/storage/objects/uploads/721de97b-5c29-4bc1-a7f9-4def830a5e4b', 430, 'a9807354-711e-11ea-8d93-0603130a05b8', 'a4fc9d3e-71a9-11ea-8d93-0603130a05b8'),
(109, 'xWater 💧', NULL, 1.00, 17, true, false, false, false, '/api/image-proxy?url=aHR0cHM6Ly9hcGkubG95dmVyc2UuY29tL2ltYWdlL2E5ODA3MmE2LTcxMWUtMTFlYS04ZDkzLTA2MDMxMzBhMDViOA', '/api/storage/objects/uploads/a927ebfc-071d-444c-957e-e976bd53cd62', 440, 'a98072a6-711e-11ea-8d93-0603130a05b8', 'a4fc9cb2-71a9-11ea-8d93-0603130a05b8'),
(110, 'Rice Bowl Shrimp 🍤', NULL, 20.00, 18, true, false, false, false, '/api/storage/objects/uploads/e5732d68-4c50-4e20-8305-ed9d5a85532a', '/api/storage/objects/uploads/02794d3e-b62e-46f7-ae28-abd49c312f4e', 180, 'a95cf990-711e-11ea-8d93-0603130a05b8', 'a4ec1c69-71a9-11ea-8d93-0603130a05b8'),
(111, 'Rice Bowl Steak 🥩', NULL, 18.00, 18, true, false, false, false, '/api/storage/objects/uploads/a9b5ced1-db3e-4415-aa31-01a550d9b2cc', '/api/storage/objects/uploads/673d03d4-e60c-421a-8fd9-cae3b23a730f', 170, 'a95cf7dc-711e-11ea-8d93-0603130a05b8', 'a4ec1ae1-71a9-11ea-8d93-0603130a05b8'),
(112, 'Rice Bowl Chicken 🍗', NULL, 16.00, 18, true, true, false, false, '/api/storage/objects/uploads/b5f10a85-5e7e-4eef-87cf-86b95a8016c7', 'https://api.loyverse.com/image/a95cdaa5-711e-11ea-8d93-0603130a05b8', 160, 'a95cdaa5-711e-11ea-8d93-0603130a05b8', 'a4ec1835-71a9-11ea-8d93-0603130a05b8'),
(113, 'Quesadilla Shrimp 🍤', NULL, 18.00, 19, true, false, false, false, '/api/storage/objects/uploads/a457dbaa-faeb-4b73-806f-a20074bb5d76', '/api/storage/objects/uploads/d547ae71-dc78-4df8-8e05-cbe2f2b3c6a2', 80, 'a95cd8fd-711e-11ea-8d93-0603130a05b8', 'a4ec16cf-71a9-11ea-8d93-0603130a05b8'),
(114, 'Quesadilla Steak 🥩', NULL, 16.00, 19, true, false, false, false, '/api/storage/objects/uploads/70dc41e0-ada7-4be6-9c86-1e97268e947d', '/api/storage/objects/uploads/26a509b7-b898-4bd0-ae3b-1437ee025816', 70, 'a95cd7d1-711e-11ea-8d93-0603130a05b8', 'a4ec15bc-71a9-11ea-8d93-0603130a05b8'),
(115, 'Quesadilla Chicken 🍗', NULL, 14.00, 19, true, false, false, false, '/api/storage/objects/uploads/b466a449-30e8-42c6-98c6-2170c47424d7', '/api/storage/objects/uploads/f34a2743-ac1a-44f0-86af-6fc4b8f0eec8', 60, 'a95cd599-711e-11ea-8d93-0603130a05b8', 'a4ec1519-71a9-11ea-8d93-0603130a05b8'),
(116, 'Burrito Shrimp 🍤', 'Juicy Shrimp in a12 inch flour tortilla with cheese, corn, salsa, rice, black beans, guacamole with our house sauce wrapped tight.', 18.00, 20, true, false, false, false, '/api/storage/objects/uploads/50b38f37-9917-4482-9d54-15492705ca18', '/api/storage/objects/uploads/a14ee3fd-fcc0-4679-99d3-83f152432a35', 130, 'a95cb545-711e-11ea-8d93-0603130a05b8', 'a4ebc52b-71a9-11ea-8d93-0603130a05b8'),
(117, 'Burrito Steak 🥩', 'Grilled Steak in a12 inch flour tortilla with cheese, corn, salsa, rice, black beans, guacamole with our house sauce wrapped tight.', 16.00, 20, true, false, false, false, '/api/storage/objects/uploads/714adcf5-54db-4726-b3bb-5f8f223a9f9f', '/api/storage/objects/uploads/5077dd51-25c6-4562-89f3-9622dde07a16', 120, 'a95cb45c-711e-11ea-8d93-0603130a05b8', 'a4ebc455-71a9-11ea-8d93-0603130a05b8')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category_id = EXCLUDED.category_id,
  available = EXCLUDED.available,
  popular = EXCLUDED.popular,
  spicy = EXCLUDED.spicy,
  vegetarian = EXCLUDED.vegetarian,
  image_url = EXCLUDED.image_url,
  pos_image_url = EXCLUDED.pos_image_url,
  sort_order = EXCLUDED.sort_order,
  loyverse_item_id = EXCLUDED.loyverse_item_id,
  loyverse_variant_id = EXCLUDED.loyverse_variant_id;

SELECT setval('menu_items_id_seq', (SELECT MAX(id) FROM menu_items));

SELECT 'Done! Imported ' || COUNT(*) || ' menu items and categories.' FROM menu_items;
