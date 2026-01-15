Create a Crossroads project
which will be a landing page for user

it will start off as an inspiration spioff from dashy, you also have dashy's config to replicate that
but from there we will start to diverge relatively fast

At the beginning I'd like to have a search bar which client side qucik filter, auto focused when i land on the page
and then, have the categories and icons representing the services as defined in some config (you pick the format but must be text so that it can be LLM adjusted) populated from the dashy one to start off, icons can be vastly improved there - please, names and addresses and categories are correct.

It should be built for speed - so if I narrow down via search i should be able to TAB and enter to open that service/link.

Then there should be global bookmarks category, currently defined separately in dashy, but here it can be just a section with links (whatsapp web, messageger, google chat, google caelndar, gmail) and maybe more in the future, then additionally we should be AI section with chatgpt, claude, gemini

edit could be monaco editor inside to adjust too

stack:
python, fastapi, uv, plain JS (but ES2023+ very modern)

dockerfile which builds the docker

Open to further ideas. PRoductivity is the key. I am sure we will add more in the future.

