from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import time
import hashlib
import secrets
from datetime import datetime, timedelta
import json
import re

app = FastAPI(
    title="Book Plus AI API",
    description="A FastAPI backend for the Book Plus AI application",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Book(BaseModel):
    id: Optional[int] = None
    title: str
    author: str
    description: Optional[str] = None
    isbn: Optional[str] = None
    published_year: Optional[int] = None

class BookCreate(BaseModel):
    title: str
    author: str
    description: Optional[str] = None
    isbn: Optional[str] = None
    published_year: Optional[int] = None

# Auth models
class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserProfile(BaseModel):
    username: str
    normal_wpm: Optional[int] = None
    skimming_wpm: Optional[int] = None
    genres: Optional[List[str]] = None
    themes: Optional[List[str]] = None
    created_at: str
    last_login: Optional[str] = None

class UserProfileUpdate(BaseModel):
    normal_wpm: Optional[int] = None
    skimming_wpm: Optional[int] = None
    genres: Optional[List[str]] = None
    themes: Optional[List[str]] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserProfile

# Content Analysis Models
class ContentSegment(BaseModel):
    text: str
    type: str  # 'dialogue', 'description', 'action', 'plot_critical'
    condensed_text: Optional[str] = None
    key_sentences: List[str] = []
    start_pos: int
    end_pos: int

class AnalyzedParagraph(BaseModel):
    index: int
    original_text: str
    segments: List[ContentSegment]
    reading_difficulty: float  # 0-1 scale
    importance_score: float  # 0-1 scale
    primary_type: str  # dominant content type

class AdaptiveContent(BaseModel):
    version: str  # 'full', 'condensed', 'summary'
    text: str
    highlighted_sentences: List[str] = []
    emphasis_type: Optional[str] = None  # 'dialogue', 'action', etc.

class ReadingPattern(BaseModel):
    content_type: str
    avg_wpm: float
    preference_score: float  # how much user likes this content type
    attention_level: float  # how carefully they read it

# In-memory storage (replace with database in production)
books_db = [
    {
        "id": 1,
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "description": "A story of the fabulously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan.",
        "isbn": "978-0743273565",
        "published_year": 1925
    },
    {
        "id": 2,
        "title": "To Kill a Mockingbird",
        "author": "Harper Lee",
        "description": "The story of young Scout Finch and her father Atticus in a racially divided Alabama town.",
        "isbn": "978-0446310789",
        "published_year": 1960
    }
]

# Auth storage
users_db: Dict[str, Dict] = {}  # username -> user data
sessions_db: Dict[str, Dict] = {}  # token -> session data

# Auth utilities
security = HTTPBearer()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_access_token(username: str) -> str:
    token = secrets.token_urlsafe(32)
    sessions_db[token] = {
        "username": username,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(days=7)
    }
    return token

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    session = sessions_db.get(token)
    
    if not session or session["expires_at"] < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    username = session["username"]
    if username not in users_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return username

# Content Analysis Functions
def classify_content_type(text: str) -> str:
    """Classify text segment by type"""
    # Count dialogue indicators
    dialogue_quotes = len(re.findall(r'"[^"]*"', text))
    dialogue_ratio = dialogue_quotes / max(1, len(text.split('.')))
    
    # Action keywords
    action_keywords = ['ran', 'jumped', 'moved', 'rushed', 'fell', 'struck', 'threw', 'caught', 'grabbed', 'shouted', 'cried']
    action_count = sum(1 for word in action_keywords if word in text.lower())
    
    # Description keywords  
    desc_keywords = ['was', 'were', 'had', 'looked', 'seemed', 'appeared', 'beautiful', 'tall', 'small', 'old', 'young']
    desc_count = sum(1 for word in desc_keywords if word in text.lower())
    
    # Plot keywords
    plot_keywords = ['suddenly', 'then', 'but', 'however', 'because', 'therefore', 'decided', 'realized', 'discovered']
    plot_count = sum(1 for word in plot_keywords if word in text.lower())
    
    if dialogue_ratio > 0.3:
        return 'dialogue'
    elif action_count > desc_count and action_count > 2:
        return 'action'
    elif plot_count > 2:
        return 'plot_critical'
    else:
        return 'description'

def condense_descriptive_text(text: str) -> str:
    """Create condensed version of descriptive passages"""
    sentences = re.split(r'[.!?]+', text)
    
    # Keep first and last sentences, plus any with plot keywords
    plot_keywords = ['but', 'however', 'then', 'suddenly', 'decided', 'realized']
    important_sentences = []
    
    for i, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # Always keep first and last
        if i == 0 or i == len(sentences) - 1:
            important_sentences.append(sentence)
        # Keep sentences with plot keywords
        elif any(keyword in sentence.lower() for keyword in plot_keywords):
            important_sentences.append(sentence)
        # Keep short, punchy sentences
        elif len(sentence.split()) < 8:
            important_sentences.append(sentence)
    
    return '. '.join(important_sentences) + '.'

def extract_key_sentences(text: str) -> List[str]:
    """Extract key sentences for highlighting"""
    sentences = re.split(r'[.!?]+', text)
    key_sentences = []
    
    # Keywords that indicate important content
    key_indicators = [
        'decided', 'realized', 'discovered', 'suddenly', 'then', 'but', 'however',
        'never', 'always', 'must', 'should', 'would', 'could', 'might'
    ]
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # Check for key indicators
        if any(indicator in sentence.lower() for indicator in key_indicators):
            key_sentences.append(sentence + '.')
        # Include dialogue
        elif '"' in sentence:
            key_sentences.append(sentence + '.')
            
    return key_sentences[:3]  # Limit to top 3

def calculate_importance_score(text: str) -> float:
    """Calculate importance score based on content"""
    # More dialogue and action = higher importance
    dialogue_count = len(re.findall(r'"[^"]*"', text))
    action_keywords = ['ran', 'jumped', 'moved', 'shouted', 'cried', 'struck']
    action_count = sum(1 for word in action_keywords if word in text.lower())
    
    # Plot advancement keywords
    plot_keywords = ['decided', 'realized', 'discovered', 'then', 'suddenly']
    plot_count = sum(1 for word in plot_keywords if word in text.lower())
    
    score = (dialogue_count * 0.3) + (action_count * 0.4) + (plot_count * 0.5)
    return min(1.0, score / 5.0)  # Normalize to 0-1

def analyze_paragraph(text: str, index: int) -> AnalyzedParagraph:
    """Analyze a paragraph and return structured content"""
    segments = []
    
    # Split by sentences for basic segmentation
    sentences = re.split(r'[.!?]+', text)
    current_pos = 0
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        content_type = classify_content_type(sentence)
        
        segment = ContentSegment(
            text=sentence + '.',
            type=content_type,
            condensed_text=condense_descriptive_text(sentence + '.') if content_type == 'description' else None,
            key_sentences=extract_key_sentences(sentence + '.') if content_type in ['plot_critical', 'dialogue'] else [],
            start_pos=current_pos,
            end_pos=current_pos + len(sentence)
        )
        segments.append(segment)
        current_pos += len(sentence) + 1
    
    # Determine primary type
    type_counts = {}
    for segment in segments:
        type_counts[segment.type] = type_counts.get(segment.type, 0) + 1
    
    primary_type = max(type_counts.items(), key=lambda x: x[1])[0] if type_counts else 'description'
    
    return AnalyzedParagraph(
        index=index,
        original_text=text,
        segments=segments,
        reading_difficulty=len(text.split()) / 50.0,  # Rough difficulty based on length
        importance_score=calculate_importance_score(text),
        primary_type=primary_type
    )

# Storage for reading patterns
user_reading_patterns: Dict[str, Dict[str, ReadingPattern]] = {}  # username -> content_type -> pattern

book1 = """    On Mondays, Wednesdays and Fridays it was Court Hand and Summulae Logicales, while the rest of the week it was the Organon, Repetition and Astrology. The governess was always getting muddled with her astrolabe, and when she got specially muddled she would take it out of the Wart by rapping his knuckles. She did not rap Kay's knuckles, because when Kay grew older he would be Sir Kay, the master of the estate. The Wart was called the Wart because it more or less rhymed with Art, which was short for his real name. Kay had given him the nickname. Kay was not called anything but Kay, as he was too dignified to have a nickname and would have flown into a passion if anybody had tried to give him one. The governess had red hair and some mysterious wound from which she derived a lot of prestige by showing it to all the women of the castle, behind closed doors. It was believed to be where she sat down, and to have been caused by sitting on some armour at a picnic by mistake. Eventually she offered to show it to Sir Ector, who was Kay's father, had hysterics and was sent away. They found out afterwards that she had been in a lunatic hospital for three years.

In the afternoons the programme was: Mondays and Fridays, tilting and horsemanship; Tuesdays, hawking; Wednesdays, fencing; Thursdays, archery; Saturdays, the theory of chivalry, with the proper measures to be blown on all occasions, terminology of the chase and hunting etiquette. If you did the wrong thing at the mort or the undoing, for instance, you were bent over the body of the dead beast and smacked with the flat side of a sword. This was called being bladed. It was horseplay, a sort of joke like being shaved when crossing the line. Kay was not bladed, although he often went wrong.

When they had got rid of the governess, Sir Ector said, "After all, damn it all, we can't have the boys runnin' about all day like hooligans—after all, damn it all? Ought to be havin' a first–rate eddication, at their age. When I was their age I was doin' all this Latin and stuff at five o'clock every mornin'. Happiest time of me life. Pass the port."

Sir Grummore Grummursum, who was staying the night because he had been benighted out questin' after a specially long run, said that when he was their age he was swished every mornin' because he would go hawkin' instead of learnin'. He attributed to this weakness the fact that he could never get beyond the Future Simple of Utor. It was a third of the way down the left–hand leaf, he said. He thought it was leaf ninety–seven. He passed the port.

Sir Ector said, "Had a good quest today?"

Sir Grummore said, "Oh, not so bad. Rattlin' good day, in fact. Found a chap called Sir Bruce Saunce Pité choppin' off a maiden's head in Weedon Bushes, ran him to Mixbury Plantation in the Bicester, where he doubled back, and lost him in Wicken Wood. Must have been a good twenty–five miles as he ran."

"A straight–necked 'un," said Sir Ector.

"But about these boys and all this Latin and that," added the old gentleman. "Amo, amas, you know, and runnin' about like hooligans: what would you advise?"

"Ah," said Sir Grummore, laying his finger by his nose and winking at the bottle, "that takes a deal of thinkin' about, if you don't mind my sayin' so."

"Don't mind at all," said Sir Ector. "Very kind of you to say anythin'. Much obliged, I'm sure. Help yourself to port."

"Good port this."

"Get it from a friend of mine."

"But about these boys," said Sir Grummore. "How many of them are there, do you know?"

"Two," said Sir Ector, "counting them both, that is."

"Couldn't send them to Eton, I suppose?" inquired Sir Grummore cautiously. "Long way and all that, we know."

It was not really Eton that he mentioned, for the College of Blessed Mary was not founded until 1440, but it was a place of the same sort. Also they were drinking Metheglyn, not Port, but by mentioning the modern wine it is easier to give you the feel.

"Isn't so much the distance," said Sir Ector, "but that giant What's–'is–name is in the way. Have to pass through his country, you understand."

"What is his name?"

"Can't recollect it at the moment, not for the life of me. Fellow that lives by the Burbly Water."

"Galapas," said Sir Grummore.

"That's the very chap."

"The only other thing," said Sir Grummore, "is to have a tutor."

"You mean a fellow who teaches you."

"That's it," said Sir Grummore. "A tutor, you know, a fellow who teaches you."

"Have some more port," said Sir Ector. "You need it after all this questin'."

"Splendid day," said Sir Grummore. "Only they never seem to kill nowadays. Run twenty–five miles and then mark to ground or lose him altogether. The worst is when you start a fresh quest."

"We kill all our giants cubbin'," said Sir Ector. "After that they give you a fine run, but get away."

"Run out of scent," said Sir Grummore, "I dare say. It's always the same with these big giants in a big country. They run out of scent."

"But even if you was to have a tutor," said Sir Ector, "I don't see how you would get him."

"Advertise," said Sir Grummore.

"I have advertised," said Sir Ector. "It was cried by the Humberland Newsman and Cardoile Advertiser."

"The only other way," said Sir Grummore, "is to start a quest."

"You mean a quest for a tutor," explained Sir Ector.

"That's it."

"Hic, Haec, Hoc," said Sir Ector. "Have some more of this drink, whatever it calls itself."

"Hunc," said Sir Grummore.

So it was decided. When Grummore Grummursum had gone home next day, Sir Ector tied a knot in his handkerchief to remember to start a quest for a tutor as soon as he had time to do so, and, as he was not sure how to set about it, he told the boys what Sir Grummore had suggested and warned them not to be hooligans meanwhile. Then they went hay–making.

It was July, and every able–bodied man and woman on the estate worked during that month in the field, under Sir Ector's direction. In any case the boys would have been excused from being eddicated just then.

Sir Ector's castle stood in an enormous clearing in a still more enormous forest. It had a courtyard and a moat with pike in it. The moat was crossed by a fortified stone bridge which ended half–way across it. The other half was covered by a wooden drawbridge which was wound up every night. As soon as you had crossed the drawbridge you were at the top of the village street—it had only one street—and this extended for about half a mile, with thatched houses of wattle and daub on either side of it. The street divided the clearing into two huge fields, that on the left being cultivated in hundreds of long narrow strips, while that on the right ran down to a river and was used as pasture. Half of the right–hand field was fenced off for hay.

It was July, and real July weather, such as they had in Old England. Everybody went bright brown, like Red Indians, with startling teeth and flashing eyes. The dogs moved about with their tongues hanging out, or lay panting in bits of shade, while the farm horses sweated through their coats and flicked their tails and tried to kick the horse–flies off their bellies with their great hind hoofs. In the pasture field the cows were on the gad, and could be seen galloping about with their tails in the air, which made Sir Ector angry.

Sir Ector stood on the top of a rick, whence he could see what everybody was doing, and shouted commands all over the two–hundred–acre field, and grew purple in the face. The best mowers mowed away in a line where the grass was still uncut, their scythes roaring in the strong sunlight. The women raked the dry hay together in long strips with wooden rakes, and the two boys with pitchforks followed up on either side of the strip, turning the hay inwards so that it lay well for picking up. Then the great carts followed, rumbling with their spiked wooden wheels, drawn by horses or slow white oxen. One man stood on top of the cart to receive the hay and direct operations, while one man walked on either side picking up what the boys had prepared and throwing it to him with a fork. The cart was led down the lane between two lines of hay, and was loaded in strict rotation from the front poles to the back, the man on top calling out in a stern voice where he wanted each fork to be pitched. The loaders grumbled at the boys for not having laid the hay properly and threatened to tan them when they caught them, if they got left behind.

When the wagon was loaded, it was drawn to Sir Ector's rick and pitched to him. It came up easily because it had been loaded systematically—not like modern hay—and Sir Ector scrambled about on top, getting in the way of his assistants, who did the real work, and stamping and perspiring and scratching about with his fork and trying to make the rick grow straight and shouting that it would all fall down as soon as the west winds came.

The Wart loved hay–making, and was good at it. Kay, who was two years older, generally stood on the edge of the bundle which he was trying to pick up, with the result that he worked twice as hard as the Wart for only half the result. But he hated to be beaten at anything, and used to fight away with the wretched hay—which he loathed like poison—until he was quite sick.

The day after Sir Grummore's visit was sweltering for the men who toiled from milking to milking and then again till sunset in their battle with the sultry element. For the hay was an element to them, like sea or air, in which they bathed and plunged themselves and which they even breathed in. The seeds and small scraps stuck in their hair, their mouths, their nostrils, and worked, tickling, inside their clothes. They did not wear many clothes, and the shadows between their sliding muscles were blue on the nut–brown skins. Those who feared thunder had felt ill that morning.

In the afternoon the storm broke. Sir Ector kept them at it till the great flashes were right overhead, and then, with the sky as dark as night, the rain came hurling against them so that they were drenched at once and could not see a hundred yards. The boys lay crouched under the wagons, wrapped in hay to keep their wet bodies warm against the now cold wind, and all joked with one another while heaven fell. Kay was shivering, though not with cold, but he joked like the others because he would not show he was afraid. At the last and greatest thunderbolt every man startled involuntarily, and each saw the other startle, until they laughed away their shame.

But that was the end of the hay–making and the beginning of play. The boys were sent home to change their clothes. The old dame who had been their nurse fetched dry jerkins out of a press, and scolded them for catching their deaths, and denounced Sir Ector for keeping on so long. Then they slipped their heads into the laundered shirts, and ran out to the refreshed and sparkling court.

"I vote we take Cully and see if we can get some rabbits in the chase," cried the Wart.

"The rabbits will not be out in this wet," said Kay sarcastically delighted to have caught him over natural history.

"Oh, come on. It will soon be dry."

"I must carry Cully, then."

Kay insisted on carrying the goshawk and flying her, when they went hawking together. This he had a right to do, not only because he was older than the Wart but also because he was Sir Ector's proper son. The Wart was not a proper son. He did not understand this, but it made him feel unhappy, because Kay seemed to regard it as making him inferior in some way. Also it was different not having a father and mother, and Kay had taught him that being different was wrong. Nobody talked to him about it, but he thought about it when he was alone, and was distressed. He did not like people to bring it up. Since the other boy always did bring it up when a question of precedence arose, he had got into the habit of giving in at once before it could be mentioned. Besides he admired Kay and was a born follower. He was a hero–worshipper.

"Come on, then," cried the Wart, and they scampered off towards the Mews, turning a few cartwheels on the way.

The Mews was one of the most important parts of the castle, next to the stables and the kennels. It was opposite to the solar, and faced south. The outside windows had to be small, for reasons of fortification, but the windows which looked inward to the courtyard were big and sunny. The windows had close vertical slats nailed down them, but not horizontal ones. There was no glass, but to keep the hawks from draughts there was horn in the small windows. At one end of the Mews there was a little fireplace and a kind of snuggery, like the place in a saddle–room where the grooms sit to clean their tack on wet nights after fox–hunting. Here there were a couple of stools, a cauldron, a bench with all sorts of small knives and surgical instruments, and some shelves with pots on them. The pots were labelled Cardamum, Ginger, Barley Sugar, Wrangle, For a Snurt, For the Craye, Vertigo, etc. There were leather skins hanging up, which had been snipped about as pieces were cut out of them for jesses, hoods or leashes. On a neat row of nails there were Indian bells and swivels and silver varvels, each with Ector cut on. A special shelf, and the most beautiful of all, held the hoods: very old cracked rufter hoods which had been made for birds before Kay was born, tiny hoods for the merlins, small hoods for tiercels, splendid new hoods which had been knocked up to pass away the long winter evenings. All the hoods, except the rufters, were made in Sir Ector's colours: white leather with red baize at the sides and a bunch of blue–grey plumes on top, made out of the hackle feathers of herons. On the bench there was a jumble of oddments such as are to be found in every workshop, bits of cord, wire, metal, tools, some bread and cheese which the mice had been at, a leather bottle, some frayed gauntlets for the left hand, nails, bits of sacking, a couple of lures and some rough tallies scratched on the wood. These read: Conays 11111111, Harn 111, etc. They were not spelled very well.

Right down the length of the room, with the afternoon sun shining full on them, there ran the screen perches to which the birds were tied. There were two little merlins which had only just been taking up from hacking, an old peregrine who was not much use in this wooded country but who was kept for appearances, a kestrel on which the boys had learned the rudiments of falconry, a spar–hawk which Sir Ector was kind enough to keep for the parish priest, and, caged off in a special apartment of his own at the far end, there was the tiercel goshawk Cully.

The Mews was neatly kept, with sawdust on the floor to absorb the mutes, and the castings taken up every day. Sir Ector visited the place each morning at seven o'clock and the two austringers stood at attention outside the door. If they had forgotten to brush their hair he confined them to barracks. They took no notice.

Kay put on one of the left–hand gauntlets and called Cully from the perch—but Cully, with all his feathers close–set and malevolent, glared at him with a mad marigold eye and refused to come. So Kay took him up.

"Do you think we ought to fly him?" asked the Wart doubtfully. "Deep in the moult like this?"

"Of course we can fly him, you ninny," said Kay. "He only wants to be carried a bit, that's all."

So they went out across the hay–field, noting how the carefully raked hay was now sodden again and losing its goodness, into the chase where the trees began to grow, far apart as yet and parklike, but gradually crowding into the forest shade. The conies had hundreds of buries under these trees, so close together that the problem was not to find a rabbit, but to find a rabbit far enough away from its hole.

"Hob says that we must not fly Cully till he has roused at least twice," said the Wart.

"Hob does not know anything about it. Nobody can tell whether a hawk is fit to fly except the man who is carrying it.

"Hob is only a villein anyway," added Kay, and began to undo the leash and swivel from the jesses.

When he felt the trappings being taken off him, so that he was in hunting order, Cully did make some movements as if to rouse. He raised his crest, his shoulder coverts and the soft feathers of his thighs. But at the last moment he thought better or worse of it and subsided without the rattle. This movement of the hawk's made the Wart itch to carry him. He yearned to take him away from Kay and set him to rights himself. He felt certain that he could get Cully into a good temper by scratching his feet and softly teasing his breast feathers upward, if only he were allowed to do it himself, instead of having to plod along behind with the stupid lure. But he knew how annoying it must be for the elder boy to be continually subjected to advice, and so he held his peace. Just as in modern shooting, you must never offer criticism to the man in command, so in hawking it was important that no outside advice should be allowed to disturb the judgment of the austringer.

"So–ho!" cried Kay, throwing his arm upward to give the hawk a better take–off, and a rabbit was scooting across the close–nibbled turf in front of them, and Cully was in the air. The movement had surprised the Wart, the rabbit and the hawk, all three, and all three hung a moment in surprise. Then the great wings of the aerial assassin began to row the air, but reluctant and undecided. The rabbit vanished in a hidden hole. Up went the hawk, swooping like a child flung high in a swing, until the wings folded and he was sitting in a tree. Cully looked down at his masters, opened his beak in an angry pant of failure, and remained motionless. The two hearts stood still."""

# Split book1 into paragraphs
book1_paragraphs = [p.strip() for p in book1.split('\n\n') if p.strip()]

# Auth endpoints
@app.post("/api/auth/register", response_model=AuthResponse)
async def register(user_data: UserRegister):
    """Register a new user"""
    if user_data.username in users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create user
    hashed_password = hash_password(user_data.password)
    now = datetime.now().isoformat()
    
    users_db[user_data.username] = {
        "username": user_data.username,
        "password_hash": hashed_password,
        "normal_wpm": None,
        "skimming_wpm": None,
        "genres": None,
        "themes": None,
        "created_at": now,
        "last_login": now
    }
    
    # Create token
    token = create_access_token(user_data.username)
    
    # Return user profile without password
    user_profile = UserProfile(
        username=user_data.username,
        normal_wpm=None,
        skimming_wpm=None,
        genres=None,
        themes=None,
        created_at=now,
        last_login=now
    )
    
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_profile
    )

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(user_data: UserLogin):
    """Login user"""
    if user_data.username not in users_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    user = users_db[user_data.username]
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Update last login
    now = datetime.now().isoformat()
    users_db[user_data.username]["last_login"] = now
    
    # Create token
    token = create_access_token(user_data.username)
    
    # Return user profile
    user_profile = UserProfile(
        username=user["username"],
        normal_wpm=user["normal_wpm"],
        skimming_wpm=user["skimming_wpm"],
        genres=user["genres"],
        themes=user["themes"],
        created_at=user["created_at"],
        last_login=now
    )
    
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_profile
    )

@app.get("/api/auth/me", response_model=UserProfile)
async def get_current_user_profile(username: str = Depends(get_current_user)):
    """Get current user profile"""
    user = users_db[username]
    return UserProfile(
        username=user["username"],
        normal_wpm=user["normal_wpm"],
        skimming_wpm=user["skimming_wpm"],
        genres=user["genres"],
        themes=user["themes"],
        created_at=user["created_at"],
        last_login=user["last_login"]
    )

@app.put("/api/auth/me", response_model=UserProfile)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    username: str = Depends(get_current_user)
):
    """Update current user profile"""
    user = users_db[username]
    
    # Update fields if provided
    if profile_data.normal_wpm is not None:
        user["normal_wpm"] = profile_data.normal_wpm
    if profile_data.skimming_wpm is not None:
        user["skimming_wpm"] = profile_data.skimming_wpm
    if profile_data.genres is not None:
        user["genres"] = profile_data.genres
    if profile_data.themes is not None:
        user["themes"] = profile_data.themes
    
    return UserProfile(
        username=user["username"],
        normal_wpm=user["normal_wpm"],
        skimming_wpm=user["skimming_wpm"],
        genres=user["genres"],
        themes=user["themes"],
        created_at=user["created_at"],
        last_login=user["last_login"]
    )

@app.post("/api/auth/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout user (invalidate token)"""
    token = credentials.credentials
    if token in sessions_db:
        del sessions_db[token]
    return {"message": "Successfully logged out"}

@app.get("/")
async def root():
    return {"message": "Welcome to Book Plus AI API"}

@app.get("/api/book1")
async def get_book1():
    """Get the book1 text"""
    return {"text": book1}

@app.get("/api/book1/paragraphs")
async def get_book1_paragraphs():
    """Get the total number of paragraphs in book1"""
    return {"total_paragraphs": len(book1_paragraphs)}

@app.get("/api/book1/paragraphs/{paragraph_index}")
async def get_book1_paragraph(paragraph_index: int):
    """Get a specific paragraph by index"""
    if paragraph_index < 0 or paragraph_index >= len(book1_paragraphs):
        raise HTTPException(status_code=404, detail="Paragraph not found")
    return {"text": book1_paragraphs[paragraph_index], "index": paragraph_index}

# Adaptive Content Endpoints
@app.get("/api/book1/paragraphs/{paragraph_index}/analyze", response_model=AnalyzedParagraph)
async def get_analyzed_paragraph(paragraph_index: int):
    """Get analyzed paragraph with content classification"""
    if paragraph_index < 0 or paragraph_index >= len(book1_paragraphs):
        raise HTTPException(status_code=404, detail="Paragraph not found")
    
    text = book1_paragraphs[paragraph_index]
    return analyze_paragraph(text, paragraph_index)

@app.get("/api/book1/paragraphs/{paragraph_index}/adaptive")
async def get_adaptive_paragraph(
    paragraph_index: int, 
    version: str = "full",
    username: str = Depends(get_current_user)
):
    """Get adaptive version of paragraph based on user reading patterns"""
    if paragraph_index < 0 or paragraph_index >= len(book1_paragraphs):
        raise HTTPException(status_code=404, detail="Paragraph not found")
    
    text = book1_paragraphs[paragraph_index]
    analyzed = analyze_paragraph(text, paragraph_index)
    
    # Get user's reading patterns for this content type
    user_patterns = user_reading_patterns.get(username, {})
    content_pattern = user_patterns.get(analyzed.primary_type)
    
    # Determine best version based on patterns
    if version == "auto" and content_pattern:
        if content_pattern.attention_level < 0.3:  # User typically skims this content
            version = "condensed"
        elif content_pattern.preference_score > 0.7:  # User loves this content type
            version = "full"
        else:
            version = "summary"
    
    # Generate adaptive content
    if version == "condensed":
        # Show condensed version with key highlights
        condensed_segments = []
        highlights = []
        
        for segment in analyzed.segments:
            if segment.type in ['plot_critical', 'dialogue']:
                condensed_segments.append(segment.text)
                highlights.extend(segment.key_sentences)
            elif segment.condensed_text:
                condensed_segments.append(segment.condensed_text)
        
        adaptive_text = ' '.join(condensed_segments)
        
    elif version == "summary":
        # Ultra-condensed version with just key points
        key_segments = [s for s in analyzed.segments if s.type in ['plot_critical', 'dialogue']]
        adaptive_text = ' '.join([s.text for s in key_segments])
        highlights = []
        for segment in key_segments:
            highlights.extend(segment.key_sentences)
            
    else:  # full version
        adaptive_text = text
        highlights = []
        for segment in analyzed.segments:
            if segment.type in ['plot_critical', 'dialogue']:
                highlights.extend(segment.key_sentences)
    
    return AdaptiveContent(
        version=version,
        text=adaptive_text,
        highlighted_sentences=highlights,
        emphasis_type=analyzed.primary_type
    )

@app.post("/api/reading-patterns/{username}")
async def update_reading_pattern(
    username: str,
    content_type: str,
    wpm: float,
    dwell_time: float,
    current_user: str = Depends(get_current_user)
):
    """Update user's reading pattern for a content type"""
    if current_user != username:
        raise HTTPException(status_code=403, detail="Cannot update other user's patterns")
    
    if username not in user_reading_patterns:
        user_reading_patterns[username] = {}
    
    # Calculate attention level based on WPM vs user's normal speed
    user_data = users_db.get(username, {})
    normal_wpm = user_data.get('normal_wpm', 200)
    
    attention_level = min(1.0, normal_wpm / max(wpm, 50))  # Higher attention = slower reading
    preference_score = min(1.0, dwell_time / 10.0)  # Longer time = higher preference
    
    # Update or create pattern
    if content_type in user_reading_patterns[username]:
        existing = user_reading_patterns[username][content_type]
        # Weighted average with existing data
        weight = 0.3  # New data weight
        user_reading_patterns[username][content_type] = ReadingPattern(
            content_type=content_type,
            avg_wpm=(existing.avg_wpm * (1 - weight)) + (wpm * weight),
            preference_score=(existing.preference_score * (1 - weight)) + (preference_score * weight),
            attention_level=(existing.attention_level * (1 - weight)) + (attention_level * weight)
        )
    else:
        user_reading_patterns[username][content_type] = ReadingPattern(
            content_type=content_type,
            avg_wpm=wpm,
            preference_score=preference_score,
            attention_level=attention_level
        )
    
    return {"status": "updated", "pattern": user_reading_patterns[username][content_type]}

@app.get("/api/reading-patterns/{username}")
async def get_reading_patterns(
    username: str,
    current_user: str = Depends(get_current_user)
):
    """Get user's reading patterns"""
    if current_user != username:
        raise HTTPException(status_code=403, detail="Cannot access other user's patterns")
    
    return user_reading_patterns.get(username, {})

@app.get("/api/books", response_model=List[Book])
async def get_books():
    """Get all books"""
    return books_db

@app.get("/api/books/{book_id}", response_model=Book)
async def get_book(book_id: int):
    """Get a specific book by ID"""
    for book in books_db:
        if book["id"] == book_id:
            return book
    raise HTTPException(status_code=404, detail="Book not found")

@app.post("/api/books", response_model=Book)
async def create_book(book: BookCreate):
    """Create a new book"""
    new_book = {
        "id": max([book["id"] for book in books_db]) + 1 if books_db else 1,
        **book.dict()
    }
    books_db.append(new_book)
    return new_book

@app.put("/api/books/{book_id}", response_model=Book)
async def update_book(book_id: int, book: BookCreate):
    """Update an existing book"""
    for i, existing_book in enumerate(books_db):
        if existing_book["id"] == book_id:
            updated_book = {"id": book_id, **book.dict()}
            books_db[i] = updated_book
            return updated_book
    raise HTTPException(status_code=404, detail="Book not found")

@app.delete("/api/books/{book_id}")
async def delete_book(book_id: int):
    """Delete a book"""
    for i, book in enumerate(books_db):
        if book["id"] == book_id:
            deleted_book = books_db.pop(i)
            return {"message": f"Book '{deleted_book['title']}' deleted successfully"}
    raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 