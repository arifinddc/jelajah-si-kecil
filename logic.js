const { useState, useEffect } = React;

const App = () => {
    const [db, setDb] = useState(null);
    const [gameState, setGameState] = useState('loading');
    const [userData, setUserData] = useState(() => {
        const saved = localStorage.getItem('phi_junior_save');
        return saved ? JSON.parse(saved) : { score: 0, lives: 3, levelIdx: 0, streak: 0, lastLifeLost: null };
    });

    const [currentPuzzle, setCurrentPuzzle] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [regenTimer, setRegenTimer] = useState("");
    const [showBonus, setShowBonus] = useState(false);

    // --- AUDIO & VOICE ---
    const speak = (txt) => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(txt);
        u.lang = 'id-ID'; u.rate = 0.9; u.pitch = 1.1;
        window.speechSynthesis.speak(u);
    };

    const playTone = (isCorrect) => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(isCorrect ? 880 : 220, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    };

    // --- LIFE REGEN ---
    useEffect(() => {
        const interval = setInterval(() => {
            if (userData.lives < 3 && userData.lastLifeLost) {
                const diff = Date.now() - userData.lastLifeLost;
                if (diff >= 600000) {
                    setUserData(p => ({ ...p, lives: Math.min(p.lives + 1, 3), lastLifeLost: p.lives+1 < 3 ? Date.now() : null }));
                } else {
                    const rem = 600000 - diff;
                    const m = Math.floor(rem/60000);
                    const s = Math.floor((rem%60000)/1000).toString().padStart(2,'0');
                    setRegenTimer(`${m}:${s}`);
                }
            } else setRegenTimer("");
        }, 1000);
        return () => clearInterval(interval);
    }, [userData.lives, userData.lastLifeLost]);

    // --- PUZZLE BUILDER ---
    const buildPuzzle = () => {
        if (userData.lives <= 0) return speak("Energi habis, yuk istirahat!");
        
        const schema = db.puzzleSchemas[Math.floor(Math.random() * db.puzzleSchemas.length)];
        const assets = db.assets;
        let target, options = [], meta = {};

        if (schema.type === "phi_sudoku") {
            const pair = assets.filter(a => a.type === "color").sort(() => 0.5 - Math.random());
            target = pair[0];
            meta = { grid: [pair[0].icon, pair[1].icon, pair[1].icon, "?"] };
            options = [pair[0], pair[1]];
        } 
        else if (schema.type === "phi_symmetry") {
            target = assets.filter(a => a.type !== "color").sort(() => 0.5 - Math.random())[0];
            options = [target, ...assets.filter(a => a.id !== target.id).slice(0, 2)];
        } 
        else {
            target = assets[Math.floor(Math.random() * assets.length)];
            options = [target, ...assets.filter(a => a.id !== target.id).slice(0, 2)];
        }

        setCurrentPuzzle({ ...schema, target, options: options.sort(() => 0.5 - Math.random()), meta });
        setGameState('playing');
        speak(schema.instruction);
    };

    const handleAnswer = (opt) => {
        if (feedback) return;
        const isCorrect = opt.id === currentPuzzle.target.id;

        if (isCorrect) {
            playTone(true); setFeedback('correct');
            const newStreak = userData.streak + 1;
            const bonus = newStreak === 10 ? 50 : 0;
            if (newStreak === 10) setShowBonus(true);
            
            setTimeout(() => {
                setUserData(p => ({ ...p, score: p.score + 10 + bonus, levelIdx: p.levelIdx + 1, streak: newStreak === 10 ? 0 : newStreak }));
                setGameState('idle'); setFeedback(null); setShowBonus(false);
            }, 1500);
        } else {
            playTone(false); setFeedback('wrong');
            setUserData(p => ({ ...p, lives: Math.max(0, p.lives - 1), streak: 0, lastLifeLost: p.lives === 3 ? Date.now() : p.lastLifeLost }));
            speak("Coba lagi sayang!");
            setTimeout(() => setFeedback(null), 800);
        }
    };

    useEffect(() => {
        fetch('data.json').then(r => r.json()).then(data => { setDb(data); setGameState('idle'); });
    }, []);

    useEffect(() => { localStorage.setItem('phi_junior_save', JSON.stringify(userData)); }, [userData]);

    if (gameState === 'loading') return null;

    return (
        <div className="game-container">
            {/* Header */}
            <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-amber-900">
                <div className="flex flex-col">
                    <span className="text-2xl">❤️ {userData.lives}</span>
                    <span className="text-[10px] text-amber-500 font-bold">{regenTimer}</span>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase">Puzzle {userData.levelIdx + 1}</div>
                    <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{width: `${userData.streak*10}%`}}></div>
                    </div>
                </div>
                <div className="bg-amber-600 px-3 py-1 rounded-full font-bold">⭐ {userData.score}</div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                {gameState === 'idle' && (
                    <div className="animate-pulse">
                        <div className="text-8xl mb-6">🧩</div>
                        <h1 className="text-2xl font-bold text-amber-500 mb-10 tracking-widest uppercase">Akademi Sage</h1>
                        <button onClick={buildPuzzle} className="bg-amber-600 text-white px-12 py-5 rounded-3xl text-2xl font-bold shadow-xl">MULAI PUZZLE</button>
                    </div>
                )}

                {gameState === 'playing' && (
                    <div className="w-full flex flex-col items-center">
                        <h2 className="text-xl font-bold mb-8 text-slate-300">{currentPuzzle.instruction}</h2>
                        
                        <div className="mb-10">
                            {currentPuzzle.type === "phi_sudoku" ? (
                                <div className="sudoku-grid">
                                    {currentPuzzle.meta.grid.map((cell, i) => (
                                        <div key={i} className="sudoku-cell">{cell}</div>
                                    ))}
                                </div>
                            ) : currentPuzzle.type === "phi_symmetry" ? (
                                <div className="symmetry-box flex items-center justify-center">
                                    <span className="symmetry-half">{currentPuzzle.target.icon}</span>
                                </div>
                            ) : (
                                <div className="w-40 h-40 bg-slate-800 rounded-[2.5rem] flex items-center justify-center border-4 border-dashed border-slate-700">
                                    {currentPuzzle.type === "phi_shadow" ? 
                                        <span className="text-8xl grayscale brightness-0 opacity-10">{currentPuzzle.target.icon}</span> : 
                                        <span className="text-7xl">❓</span>}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            {currentPuzzle.options.map((opt, i) => (
                                <button key={i} onClick={() => handleAnswer(opt)} 
                                    className={`btn-choice ${feedback === 'correct' && opt.id === currentPuzzle.target.id ? 'glow-gold' : ''}`}>
                                    <span className={currentPuzzle.type === "phi_symmetry" ? 'symmetry-option' : ''}>{opt.icon}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showBonus && (
                <div className="absolute inset-0 bg-amber-500 flex flex-col items-center justify-center z-50 text-white">
                    <div className="text-9xl mb-4 animate-bounce">🏆</div>
                    <h2 className="text-4xl font-black">BONUS +50!</h2>
                </div>
            )}
            
            <div className="p-3 text-center text-[9px] text-slate-600 font-bold uppercase tracking-[0.3em]">Sage Brain v12.1</div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
