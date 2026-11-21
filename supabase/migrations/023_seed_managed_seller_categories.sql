-- 023: seed the managed seller category catalogue for the first marketplace rollout.
begin;
insert into public.collections(name,grp,icon) values
 ('Groceries','Food and daily needs','🛒'),
 ('Food and Drinks','Food and daily needs','🥘'),
 ('Fashion and Clothing','Fashion','👗'),
 ('Shoes','Fashion','👟'),
 ('Bags','Fashion','👜'),
 ('Accessories','Fashion','⌚'),
 ('Skincare','Beauty and personal care','🧴'),
 ('Beauty and Personal Care','Beauty and personal care','✨'),
 ('Hair and Wigs','Beauty and personal care','💇'),
 ('Phones and Tablets','Electronics','📱'),
 ('Computers','Electronics','💻'),
 ('Electronics','Electronics','🎧'),
 ('Home and Kitchen','Home and living','🏠'),
 ('Furniture','Home and living','🛋️'),
 ('Baby and Kids','Family','🧸'),
 ('Toys and Games','Family','🎮'),
 ('Sports and Fitness','Lifestyle','🏋️'),
 ('Books and Stationery','Learning','📚'),
 ('Automotive','Tools and mobility','🚗'),
 ('Building and Tools','Tools and mobility','🛠️'),
 ('Office Supplies','Work and business','🗂️'),
 ('Pet Supplies','Lifestyle','🐾')
on conflict(name) do nothing;
commit;
