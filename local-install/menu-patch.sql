-- Island Tacos - Modifiers + Image URL Fix
-- Run with:
--   $env:PGPASSWORD="data1234"; $env:PGCLIENTENCODING="UTF8"; & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U ituser -d islandtacos -f "C:\IslandTacos\menu-patch.sql"

SET client_encoding = 'UTF8';

-- ============================================================
-- FIX IMAGE URLS (point local storage paths to production)
-- ============================================================

UPDATE menu_items SET
  image_url = CASE
    WHEN image_url LIKE '/api/storage/%' THEN 'https://orders.islandtacosbvi.com' || image_url
    ELSE image_url
  END,
  pos_image_url = CASE
    WHEN pos_image_url LIKE '/api/storage/%' THEN 'https://orders.islandtacosbvi.com' || pos_image_url
    ELSE pos_image_url
  END;

-- ============================================================
-- MODIFIERS
-- ============================================================

INSERT INTO modifiers (id, loyverse_id, name, options, required, min_selections, max_selections, sort_order) VALUES
(12, 'c89b98e5-9c50-4194-8754-7bd88e59ff58', 'Combo/Mix', '[{"id":"9e6756a1-b23b-4f4d-9324-3d3b8d1687f2","name":"Extra Steak 🥩","price":6,"position":0,"maxQuantity":2,"allowMultiple":true},{"id":"d29ea7e5-95f3-43ed-a9af-4eae9c24f124","name":"Extra Chicken 🍗","price":5,"position":1,"maxQuantity":2,"allowMultiple":true},{"id":"469a0e59-382c-4db7-afaa-c7b82b8dbd6a","name":"Extra Shrimp 🍤","price":6,"position":2,"maxQuantity":2,"allowMultiple":true},{"id":"a34201e0-4047-44d4-9a65-abc5cf1e63e8","name":"Extra Grilled Veggies 🥬","price":4,"position":3,"maxQuantity":2,"allowMultiple":true}]', false, 0, NULL, 0),
(6, '12efde72-897e-4884-9ef4-23aae9c47788', 'Sauce', '[{"id":"6fb61a52-23a9-4905-b9e6-dbb35d52ba5b","name":"Chipotle","price":0,"position":1},{"id":"bfac0601-1aa4-4850-a272-6e832d93dd42","name":"Salsa Verde/Green","price":0,"position":2},{"id":"33ace5d8-469b-4475-8006-81594ff81876","name":"No Sauce","price":0,"position":3}]', false, 0, NULL, 10),
(11, 'e49796b9-9695-4228-bf20-6fdfea44745a', 'Remove', '[{"id":"c56f56e1-c079-4c5f-ad31-8e2916f29492","name":"No Tomate/Salsa 🍅","price":0,"position":1},{"id":"30c32190-05ef-44a3-9be8-0fb8631004ac","name":"No Guacamole 🥑","price":0,"position":2},{"id":"51b0e5f9-c97d-4abf-a386-6837620f7409","name":"No Beans","price":0,"position":3},{"id":"ca8d57bc-ef78-4368-8322-b1260f88b84a","name":"No Rice 🍚","price":0,"position":4},{"id":"a939c66a-cd48-471d-adaa-82650a699532","name":"No Cabbage 🥬","price":0,"position":5},{"id":"6fc2215a-0feb-43bc-922e-bd1871b723cc","name":"No Corn 🌽","price":0,"position":6},{"id":"e51d7152-46cc-4e36-b74a-d97518222b60","name":"No Cheese 🧀","price":0,"position":7}]', false, 0, NULL, 20),
(13, '919039a4-71b4-11ea-8d93-0603130a05b8', 'Extra', '[{"id":"49bb71d6-adcf-4378-a7ec-3fd670a2613a","name":"Extra Cheese 🧀","price":2,"position":0},{"id":"33a5e829-689b-4f2e-a8cb-33c5e30457bd","name":"Extra sauce 🍼","price":1,"position":1},{"id":"6686deff-5b29-479a-8bd2-3a1fa3b0896c","name":"Extra Sour Cream","price":2,"position":2},{"id":"772624eb-a5cb-4fb7-a3f2-813fb81d952d","name":"Extra Guacamole 🥑","price":2,"position":3},{"id":"3371878e-5513-4cbf-b542-cb5b5be236f0","name":"Extra Beans","price":1,"position":4},{"id":"a8d787b1-449b-419d-9ee8-819de3f38c9f","name":"Extra Tomato/Salsa 🍅","price":2,"position":5},{"id":"c4adb455-1e26-4428-9686-ff37d3fba4c6","name":"Extr Corn 🌽","price":1,"position":6},{"id":"60dd2bcf-b85f-44a1-97ad-09ccb6a81f01","name":"Extra Jalapeño 🌶","price":1,"position":7},{"id":"5530132d-0866-499b-a95a-1c5723af750a","name":"Picante 🔥","price":1,"position":8},{"id":"859a8bb4-e61b-4fbc-b56c-778114d10ef2","name":"Extra Cabbage 🥬","price":1,"position":9}]', false, 0, NULL, 30),
(3, 'a369b587-8a4b-4415-be15-528bc1bda7f3', 'Burger Remove', '[{"id":"056b65a6-0ef2-4514-a1d1-a7d24a72e993","name":"Hold Sauce","price":0,"position":1},{"id":"2d7eaf13-c23f-4760-9913-4c65a7ba049e","name":"Hold Tomato","price":0,"position":2},{"id":"af4f4c34-e7dd-401c-88e1-a6ce6606529f","name":"Hold Lettuce","price":0,"position":3},{"id":"a2be1338-53cc-4326-917b-9410c2a4d0fb","name":"Hold Guacamole","price":0,"position":4},{"id":"477b3538-ac13-43f0-bc01-038dfc01e7d9","name":"Hold Jalapeños","price":0,"position":5},{"id":"7bd13bed-76ea-4ac9-8ba1-5cd85e125bee","name":"Hold Cheese","price":0,"position":6}]', false, 0, NULL, 40),
(17, 'b336ffc8-df22-4ec3-ac5b-1d8097b914cb', 'Extra Quesadilla', '[{"id":"b39c2bab-5ea0-471f-965a-21ca68f95798","name":"Extra Cheese","price":2,"position":1},{"id":"c6a65037-52fa-4d5e-8ad2-7f69afc6d236","name":"Extra Tomato/Pico","price":2,"position":2},{"id":"1537b608-5c57-46d4-9f58-5272d71a8c6b","name":"Extra Corn","price":1,"position":3},{"id":"197e3e60-8d8b-47e2-a104-7c78cd62107c","name":"Sour Cream","price":2,"position":4}]', false, 0, NULL, 50),
(15, '92376cda-d3d0-44b0-ad7c-373a93a4c0e0', 'Extra Taco', '[{"id":"376d3b72-8239-42e3-a023-2ade28cd5554","name":"Cabbage","price":1,"position":1},{"id":"7d0cffdb-8bf3-4e4b-b22d-fa7d8d366a86","name":"Cheese","price":2,"position":2},{"id":"1ec11038-c279-453d-bd8c-98768e24c305","name":"Corn","price":1,"position":3},{"id":"a42bdbbc-ba04-46e0-8c59-4742da2c9916","name":"Tomato/Pico","price":2,"position":4},{"id":"28131885-efa2-43de-82d1-df212690c991","name":"Extra Guacamole","price":2,"position":5},{"id":"881332ac-dabd-451f-a985-4fa997fb5067","name":"Sour Cream","price":2,"position":6}]', false, 0, NULL, 60),
(1, '96b590f5-9b1b-4719-861b-e4463bb1bc74', 'Fried Rice Hold', '[{"id":"18f17c69-0178-47cc-a0e9-26a94d00854e","name":"Hold Beans","price":0,"position":1},{"id":"6669461b-b950-4ff7-93ec-b2e582526ed5","name":"Hold Corn","price":0,"position":2},{"id":"fc4a8776-98fd-49a6-815a-7f49e8353240","name":"Hold Cabbage","price":0,"position":3},{"id":"8a8ceb96-a407-43d1-981b-39f9b9662c9f","name":"Hold Mixed Veggies","price":0,"position":4}]', false, 0, NULL, 70),
(10, '24031d50-2694-4a84-9576-89c913944268', 'Half', '[{"id":"6de267e9-912a-4e0b-8707-cfcbc8c9075a","name":"Half Rice","price":0,"position":1},{"id":"a5d75850-5d14-4f4e-b64c-c3bfc0af0c96","name":"Half Beans","price":0,"position":2},{"id":"f76780c0-687a-4def-8a7d-0ba2b23999a6","name":"Half Cheese","price":0,"position":3},{"id":"3512b91b-ade0-45a0-ab32-d363122b176e","name":"Half Sauce","price":0,"position":4},{"id":"ad41c2cf-d308-4dee-a351-be6c87945339","name":"Half Tomato Salsa","price":0,"position":5}]', false, 0, NULL, 80),
(5, '98b21c87-75da-47bd-8abc-dc58ed97a88b', 'Kids', '[{"id":"3dfbc2fe-cc75-4037-8afc-1a7d5b5c3f82","name":"Beans","price":0,"position":0,"maxQuantity":1,"allowMultiple":false},{"id":"88f9c95b-8390-4cbe-93a1-ca32aa7bdee9","name":"Corn 🌽","price":0,"position":1,"maxQuantity":1,"allowMultiple":false},{"id":"2d283bf4-a017-4331-8833-8345f9f27bf9","name":"Cabbage 🥬","price":0,"position":2,"maxQuantity":1,"allowMultiple":false},{"id":"5effb7d0-719d-4b5b-8bcf-96bf683015e7","name":"Cheese 🧀","price":0,"position":3,"maxQuantity":1,"allowMultiple":false},{"id":"f9760aec-d1ca-4dce-894c-1a7cba59ee64","name":"Tomato 🍅","price":0,"position":4,"maxQuantity":1,"allowMultiple":false},{"id":"39dfdd78-4338-4a70-bfa4-c4d4c621c9b5","name":"Guacamole 🥑","price":0,"position":5,"maxQuantity":1,"allowMultiple":false}]', false, 0, 2, 90),
(8, '033d3fe5-e35c-4f74-a053-70273108660d', 'On The Side', '[{"id":"59dc63fe-ecf5-48b9-82ac-46a14fe56ff7","name":"Sauce on the Side","price":0,"position":1},{"id":"49640735-f2a4-4c5a-b058-3a0728d5713e","name":"Guacamole on the Side","price":0,"position":2},{"id":"ee0ab6f1-6db8-41c2-a9ad-73949614d8c5","name":"Sour Cream on the Side","price":0,"position":3},{"id":"0e853756-96b5-4107-a696-654de2dea286","name":"Tomato on the Side","price":0,"position":4},{"id":"8a689e3e-6979-4810-8e13-367332b50e1d","name":"Beans on the Side","price":0,"position":5},{"id":"d5d6dc0e-860c-4c3b-968b-ce37732dc66d","name":"Cheese on the Side","price":0,"position":6}]', false, 0, NULL, 100),
(16, '3ed38de5-0bef-4dc0-add6-a6c7667875c5', 'Remove Quesadilla', '[{"id":"1291444b-80bd-4f05-ae3a-74f99d8ca3f7","name":"Tomato/Pico","price":0,"position":1},{"id":"baa1af50-ab2d-40de-8111-d9ad77d5ce8e","name":"Corn","price":0,"position":2}]', false, 0, NULL, 110),
(14, '64d00723-cfcb-4280-94aa-907f0ea5d70f', 'Remove Taco', '[{"id":"76d51bad-ca6a-4a98-a4e6-217632a30f39","name":"No Cabbage","price":0,"position":1},{"id":"6599963d-b821-4f5d-a0b1-7021850e9b62","name":"No Cheese","price":0,"position":2},{"id":"ce1686ab-dad4-425e-adde-979a9e171549","name":"No Corn","price":0,"position":3},{"id":"dddff37f-9b6d-425e-a67b-141f59ad9215","name":"No Tomato/Pico","price":0,"position":4},{"id":"07bab5aa-2389-4176-8b34-82e07c2fb781","name":"No Guacamole","price":0,"position":5}]', false, 0, NULL, 120),
(4, '419b1284-364f-4cdc-b591-4fa685eeb888', 'Sides', '[{"id":"9e01b32a-dffa-4b37-a2c4-361d32e91037","name":"Fries","price":4,"position":1}]', false, 0, NULL, 130)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  options = EXCLUDED.options,
  required = EXCLUDED.required,
  min_selections = EXCLUDED.min_selections,
  max_selections = EXCLUDED.max_selections,
  sort_order = EXCLUDED.sort_order;

SELECT setval('modifiers_id_seq', (SELECT MAX(id) FROM modifiers));

-- Link modifiers to menu items
UPDATE menu_items SET loyverse_modifier_ids = ARRAY(
  SELECT m.loyverse_id FROM modifiers m
  WHERE m.id IN (
    SELECT UNNEST(
      ARRAY(SELECT id::text FROM modifiers)::int[]
    )
  )
) WHERE false; -- placeholder, actual links come from Loyverse sync

SELECT 'Done! ' || COUNT(*) || ' modifiers imported.' AS result FROM modifiers;
