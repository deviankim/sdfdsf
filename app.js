(() => {
  'use strict';

  const NAMES = [
    '블랙 코멧', '청풍', '루나 스텝', '골든 애로우', '레드 노바', '미라지',
    '스톰 브레이커', '새벽별', '실버 펄스', '태풍의 눈', '마하 퀸', '하이랜드',
    '문라이트', '번개탄', '아틀라스', '블루 리본', '백야', '윈드 러너'
  ];
  const STYLES = ['선행형', '선입형', '추입형', '균형형'];
  const DISTANCES = [1000, 1200, 1400, 1600, 1800, 2000];
  const TRACKS = [
    { name: '건조', icon: '☀️', speedBias: 1.04, staminaBias: .98, chaos: .95 },
    { name: '양호', icon: '🌤️', speedBias: 1, staminaBias: 1, chaos: 1 },
    { name: '다습', icon: '🌦️', speedBias: .98, staminaBias: 1.02, chaos: 1.08 },
    { name: '포화', icon: '🌧️', speedBias: .94, staminaBias: 1.06, chaos: 1.18 }
  ];

  const $ = (id) => document.getElementById(id);
  const els = {
    coins: $('coins'), conditions: $('conditions'), horseCards: $('horseCards'), briefing: $('briefing'),
    newRaceBtn: $('newRaceBtn'), startBtn: $('startBtn'), stakeSelect: $('stakeSelect'), track: $('track'),
    raceStatus: $('raceStatus'), resultPanel: $('resultPanel'), resultTitle: $('resultTitle'),
    resultMessage: $('resultMessage'), podium: $('podium'), nextBtn: $('nextBtn'), raceTitle: $('raceTitle')
  };

  const state = {
    coins: 1000,
    raceNo: 1,
    horses: [],
    selected: null,
    distance: 1400,
    track: TRACKS[1],
    racing: false,
    animation: null
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rnd = (min, max) => Math.random() * (max - min) + min;
  const randint = (min, max) => Math.floor(rnd(min, max + 1));
  const shuffle = (arr) => [...arr].sort(() => Math.random() - .5);
  const normal = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  function buildHorse(name, gate) {
    const style = STYLES[randint(0, STYLES.length - 1)];
    const base = randint(57, 82);
    const skew = () => clamp(Math.round(base + normal() * 10), 45, 96);
    return {
      id: `${Date.now()}-${gate}-${Math.random()}`,
      gate,
      name,
      style,
      speed: skew(),
      stamina: skew(),
      start: skew(),
      finish: skew(),
      consistency: randint(52, 94),
      condition: randint(88, 108),
      probability: 0,
      rating: 0,
      odds: 0,
      progress: 0,
      energy: 1,
      raceScore: 0,
      incident: null
    };
  }

  function courseWeights() {
    const d = state.distance;
    const sprint = clamp((1600 - d) / 700, 0, 1);
    const long = clamp((d - 1200) / 900, 0, 1);
    return {
      speed: .34 + sprint * .13,
      stamina: .18 + long * .18,
      start: .17 + sprint * .09,
      finish: .19 + long * .06,
      consistency: .12
    };
  }

  function styleBonus(horse) {
    const d = state.distance;
    if (horse.style === '선행형') return d <= 1400 ? 4 : d >= 1800 ? -2 : 1;
    if (horse.style === '추입형') return d >= 1600 ? 4 : d <= 1200 ? -2 : 1;
    if (horse.style === '선입형') return d >= 1400 ? 2 : 1;
    return 1.5;
  }

  function deterministicRating(horse) {
    const w = courseWeights();
    const raw =
      horse.speed * w.speed * state.track.speedBias +
      horse.stamina * w.stamina * state.track.staminaBias +
      horse.start * w.start +
      horse.finish * w.finish +
      horse.consistency * w.consistency +
      styleBonus(horse) +
      (horse.condition - 98) * .32;
    return raw;
  }

  function simulationScore(horse) {
    const base = deterministicRating(horse);
    const volatility = (104 - horse.consistency) * .12 * state.track.chaos;
    const paceLuck = normal() * volatility;
    const breakLuck = normal() * (horse.start < 60 ? 2.4 : 1.35) * state.track.chaos;
    const conditionNoise = normal() * 1.4;
    return base + paceLuck + breakLuck + conditionNoise;
  }

  function estimateProbabilities() {
    const wins = Array(state.horses.length).fill(0);
    const rounds = 900;
    for (let i = 0; i < rounds; i++) {
      let best = 0;
      let bestScore = -Infinity;
      state.horses.forEach((horse, idx) => {
        const s = simulationScore(horse);
        if (s > bestScore) { bestScore = s; best = idx; }
      });
      wins[best]++;
    }
    state.horses.forEach((horse, idx) => {
      horse.rating = Math.round(deterministicRating(horse));
      horse.probability = wins[idx] / rounds;
      horse.odds = clamp(.86 / Math.max(.035, horse.probability), 1.35, 18);
    });
  }

  function formatCondition(horse) {
    if (horse.condition >= 104) return '최상';
    if (horse.condition >= 99) return '좋음';
    if (horse.condition >= 94) return '보통';
    return '저조';
  }

  function renderConditions() {
    els.conditions.innerHTML = `
      <span class="chip">📏 ${state.distance.toLocaleString()}m</span>
      <span class="chip">${state.track.icon} 주로 ${state.track.name}</span>
      <span class="chip">🎲 이변도 ${state.track.chaos >= 1.15 ? '높음' : state.track.chaos > 1 ? '보통+' : '보통'}</span>
    `;
  }

  function statRow(label, value) {
    return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${value}%"></i></div><b>${value}</b></div>`;
  }

  function renderCards() {
    const sorted = [...state.horses].sort((a, b) => b.probability - a.probability);
    els.horseCards.innerHTML = state.horses.map(horse => {
      const selected = horse.id === state.selected;
      return `
        <article class="horse-card ${selected ? 'selected' : ''}" data-id="${horse.id}">
          <div class="horse-top">
            <div class="gate">${horse.gate}</div>
            <div><div class="horse-name">${horse.name}</div><div class="style">${horse.style} · 컨디션 ${formatCondition(horse)}</div></div>
            <div class="prob"><strong>${Math.round(horse.probability * 100)}%</strong><span>예상 승률</span></div>
          </div>
          <div class="rating-row"><span class="rating">전력 ${horse.rating}</span><span class="odds">예상 ${horse.odds.toFixed(1)}배</span></div>
          <div class="stats">
            ${statRow('속도', horse.speed)}
            ${statRow('지구력', horse.stamina)}
            ${statRow('출발', horse.start)}
            ${statRow('막판', horse.finish)}
            ${statRow('안정성', horse.consistency)}
          </div>
          <button class="pick-btn" type="button">${selected ? '선택됨 ✓' : '이 말 선택'}</button>
        </article>`;
    }).join('');

    els.horseCards.querySelectorAll('.horse-card').forEach(card => {
      card.querySelector('.pick-btn').addEventListener('click', () => selectHorse(card.dataset.id));
    });

    const top = sorted[0];
    const second = sorted[1];
    const upset = sorted.find(h => h !== top && h.finish >= 82) || second;
    els.briefing.textContent = `${top.name}가 전력 지수와 코스 적성에서 가장 앞섭니다. ${second.name}도 ${Math.round(second.probability * 100)}%의 예상 승률로 근접해 있고, ${upset.name}는 막판 능력치가 높아 초반 열세를 뒤집을 여지가 있습니다. 예상 승률은 힌트일 뿐 확정 결과는 아닙니다.`;
  }

  function renderTrack() {
    els.track.innerHTML = state.horses.map(h => `
      <div class="lane" data-gate="${h.gate}">
        <div class="runner" id="runner-${h.gate}" aria-label="${h.name}">🐎<b>${h.gate}</b></div>
      </div>`).join('');
  }

  function selectHorse(id) {
    if (state.racing) return;
    state.selected = id;
    renderCards();
    const horse = state.horses.find(h => h.id === id);
    els.startBtn.disabled = false;
    els.startBtn.textContent = `${horse.name} 예측 확정`;
  }

  function newRace({ advance = false } = {}) {
    if (state.racing) return;
    if (advance) state.raceNo += 1;
    state.distance = DISTANCES[randint(0, DISTANCES.length - 1)];
    state.track = TRACKS[randint(0, TRACKS.length - 1)];
    state.horses = shuffle(NAMES).slice(0, 6).map((name, idx) => buildHorse(name, idx + 1));
    state.selected = null;
    estimateProbabilities();
    els.raceTitle.textContent = `제${state.raceNo}경주`;
    els.resultPanel.hidden = true;
    els.startBtn.disabled = true;
    els.startBtn.textContent = '말을 선택하세요';
    els.newRaceBtn.disabled = false;
    els.raceStatus.textContent = '출발 준비 중';
    renderConditions();
    renderCards();
    renderTrack();
  }

  function segmentPower(horse, segment) {
    const d = state.distance;
    const speed = horse.speed * state.track.speedBias;
    const stamina = horse.stamina * state.track.staminaBias;
    let core = 0;

    if (segment < .18) {
      core = speed * .35 + horse.start * .48 + stamina * .17;
      if (horse.style === '선행형') core += 4;
      if (horse.style === '추입형') core -= 2.2;
    } else if (segment < .68) {
      core = speed * .46 + stamina * .41 + horse.start * .13;
      if (horse.style === '선입형') core += 2.2;
      if (horse.style === '균형형') core += 1.3;
    } else {
      core = speed * .35 + stamina * .27 + horse.finish * .38;
      if (horse.style === '추입형') core += 5;
      if (horse.style === '선행형' && d >= 1800) core -= 2.5;
    }

    const fatigue = Math.max(0, (segment - .55)) * (100 - stamina) * (d / 1800) * .11;
    const consistencyNoise = normal() * ((108 - horse.consistency) * .055) * state.track.chaos;
    return core - fatigue + consistencyNoise + normal() * 1.7;
  }

  function maybeIncident(horse, elapsed) {
    if (horse.incident || elapsed < .12 || elapsed > .88) return 0;
    const chance = .0017 * state.track.chaos;
    if (Math.random() < chance) {
      const incidents = [
        { text: '진로가 잠깐 막혔습니다', loss: 7 },
        { text: '바깥으로 크게 돌았습니다', loss: 5 },
        { text: '균형을 잃고 주춤했습니다', loss: 9 }
      ];
      const hit = incidents[randint(0, incidents.length - 1)];
      horse.incident = hit.text;
      els.raceStatus.textContent = `${horse.name}, ${hit.text}!`;
      return hit.loss;
    }
    return 0;
  }

  function updateRaceFrame(dt) {
    const alive = state.horses.filter(h => h.progress < 1);
    alive.forEach(horse => {
      const power = segmentPower(horse, horse.progress);
      const loss = maybeIncident(horse, horse.progress);
      const variance = 1 + normal() * .009 * state.track.chaos;
      const step = Math.max(.0005, (power - loss) / 84 * dt * .000095 * variance * (1400 / state.distance));
      horse.progress = Math.min(1, horse.progress + step);
      if (horse.progress >= 1 && !horse.finishTime) horse.finishTime = performance.now();
      const node = document.getElementById(`runner-${horse.gate}`);
      if (node) {
        const laneWidth = node.parentElement.clientWidth;
        const travel = Math.max(0, laneWidth - 122);
        node.style.transform = `translate(${travel * horse.progress}px,-50%)`;
      }
    });
  }

  function runRace() {
    if (state.racing || !state.selected) return;
    const stake = Number(els.stakeSelect.value);
    if (stake > state.coins) {
      els.raceStatus.textContent = '보유 코인이 부족합니다. 더 작은 금액을 선택하세요.';
      return;
    }
    state.coins -= stake;
    updateCoins();
    state.racing = true;
    state.horses.forEach(h => { h.progress = 0; h.finishTime = null; h.incident = null; });
    els.startBtn.disabled = true;
    els.newRaceBtn.disabled = true;
    els.stakeSelect.disabled = true;
    els.resultPanel.hidden = true;
    els.raceStatus.textContent = '출발했습니다!';
    let prev = performance.now();

    const tick = (now) => {
      const dt = Math.min(35, now - prev);
      prev = now;
      updateRaceFrame(dt);
      const finished = state.horses.filter(h => h.finishTime).length;
      const leader = [...state.horses].sort((a, b) => b.progress - a.progress)[0];
      if (finished === 0 && leader.progress > .72) els.raceStatus.textContent = `직선 진입! ${leader.name} 선두`;
      if (finished < state.horses.length) {
        state.animation = requestAnimationFrame(tick);
      } else {
        finishRace(stake);
      }
    };
    state.animation = requestAnimationFrame(tick);
  }

  function finishRace(stake) {
    state.racing = false;
    els.stakeSelect.disabled = false;
    const order = [...state.horses].sort((a, b) => a.finishTime - b.finishTime);
    const winner = order[0];
    const pick = state.horses.find(h => h.id === state.selected);
    const won = winner.id === pick.id;
    let payout = 0;
    if (won) {
      payout = Math.round(stake * winner.odds);
      state.coins += payout;
    }
    if (state.coins < 50) state.coins = 500;
    updateCoins();

    els.raceStatus.textContent = `${winner.name} 우승!`;
    els.resultTitle.textContent = won ? '예측 적중!' : '이번엔 빗나갔습니다';
    els.podium.innerHTML = order.slice(0, 3).map((h, idx) => `
      <div class="place"><strong>${idx + 1}위 · ${h.gate}번 ${h.name}</strong><span>예상 승률 ${Math.round(h.probability * 100)}% · 전력 ${h.rating}${h.incident ? ` · ${h.incident}` : ''}</span></div>`).join('');

    const favorite = [...state.horses].sort((a, b) => b.probability - a.probability)[0];
    const surprise = winner.id !== favorite.id;
    els.resultMessage.textContent = won
      ? `${pick.name} 선택이 맞았습니다. ${stake.toLocaleString()} 코인 예측으로 ${payout.toLocaleString()} 코인을 받았습니다.${surprise ? ' 데이터상 1순위가 아닌 말이 이기며 이변도 함께 나왔습니다.' : ''}`
      : `${pick.name}을 선택했지만 우승은 ${winner.name}였습니다. ${surprise ? `${favorite.name}가 가장 높은 예상 승률이었지만 랜덤 전개가 결과를 뒤집었습니다.` : '이번 경주는 사전 전력 우세가 결과로 이어졌습니다.'}`;
    els.resultPanel.hidden = false;
    els.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateCoins() {
    els.coins.textContent = state.coins.toLocaleString();
  }

  els.newRaceBtn.addEventListener('click', () => newRace());
  els.nextBtn.addEventListener('click', () => newRace({ advance: true }));
  els.startBtn.addEventListener('click', runRace);
  els.stakeSelect.addEventListener('change', () => {
    const stake = Number(els.stakeSelect.value);
    if (stake > state.coins) els.raceStatus.textContent = '현재 코인보다 큰 금액입니다.';
  });

  updateCoins();
  newRace();
})();
