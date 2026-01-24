const key = `hyperfall:leaderboard`

if (world.isServer) {
  const state = app.state
  // world.set(key, null)
  const entries = world.get(key) || []          // { playerId, name, kills, deaths }
  function getKDR({ kills, deaths }) {
    if (deaths === 0) {
      // if they have 0 deaths but >0 kills, treat ratio as Infinity.
      // if kills also 0, treat ratio as 0 (did nothing).
      return kills > 0 ? Number.POSITIVE_INFINITY : 0;
    }
    return kills / deaths;
  }
  function sort() {
    entries.sort((a, b) => {
      // anons go away
      if (a.name === "Anonymous" && b.name !== "Anonymous") return 1;
      if (a.name !== "Anonymous" && b.name === "Anonymous") return -1;
      // get k/d ratios
      const ratioA = getKDR(a)
      const ratioB = getKDR(b)
      // sort descending by ratio:
      if (ratioA !== ratioB) return ratioB - ratioA;
      // tiebreaker: sort descending by kills:
      if (a.kills !== b.kills) return b.kills - a.kills
      // next tiebreaker: sort ascending by deaths:
      return a.deaths - b.deaths
    })
    // console.log(entries)
  }
  // function sort() {
  //   entries.sort((a, b) => {
  //     // first sort by ratio (descending)
  //     if (b.ratio !== a.ratio) return b.ratio - a.ratio
  //     // if ratios are equal, sort by kills (descending)
  //     if (b.kills !== a.kills) return b.kills - a.kills
  //     // if kills are equal, sort by deaths (ascending)
  //     return a.deaths - b.deaths
  //   })
  // }
  sort()
  state.rows = entries.slice(0, 10).map(entry => ({ ...entry }))
  state.ready = true
  world.on('prism:died', ([victimTag, killerTag]) => {
    let updated
    // track players killing players (mobs excluded)
    if (victimTag.startsWith('player:') && killerTag.startsWith('player:')) {
      const victimId = victimTag.slice(7)
      const victim = world.getPlayer(victimId)
      if (victim) {
        const name = victim.name
        let entry = entries.find(entry => entry.playerId === victimId)
        if (!entry) {
          entry = { playerId: victimId, name, kills: 0, deaths: 0 }
          entries.push(entry)
        }
        entry.name = name
        entry.deaths++
        updated = true
      }
      const killerId = killerTag.slice(7)
      const killer = world.getPlayer(killerId)
      if (killer) {
        const name = killer.name
        let entry = entries.find(entry => entry.playerId === killerId)
        if (!entry) {
          entry = { playerId: killerId, name, kills: 0, deaths: 0 }
          entries.push(entry)
        }
        entry.name = name
        entry.kills++
        entry.ratio = entry.deaths > 0 ? entry.kills / entry.deaths : entry.kills
        updated = true
      }
    }
    // send changes
    if (updated) {
      sort()
      const nextRows = entries.slice(0, 10).map(entry => ({ ...entry }))
      for (let i = 0; i < 10; i++) {
        const prev = state.rows[i]
        const next = nextRows[i]
        if (!prev && !next) continue
        if (!prev || !next) {
          app.send('change', [i, next || null])
          continue
        }
        const changed = (!prev && next) || (prev && !next) || prev.playerId !== next.playerId || prev.name !== next.name || prev.kills !== next.kills || prev.deaths !== next.deaths
        if (changed) app.send('change', [i, next])
      }
      state.rows = nextRows
      world.set(key, entries)
    }
  })
  app.send('init', state)
}

if (world.isClient) {
  if (app.state.ready) {
    init(app.state)
  } else {
    app.on('init', init)
  }
  function init(state) {
    const ui = createBoard(state.rows)
    ui.node.position.set(0,1,0)
    ui.node.rotation.set(0 * DEG2RAD, 0 * DEG2RAD, 0 * DEG2RAD)
    ui.node.scale.setScalar(2.5)
    app.add(ui.node)
    app.on('change', ([idx, entry]) => {
      ui.change(idx, entry)
    })
  }
}

function createBoard(rows) {
  const $ui = app.create('ui', {
    width: 400,
    height: 300,
    pivot: 'bottom-center',
    backgroundColor: 'rgba(0,0,0,.5)',
    padding: 20,
    borderWidth:4,
    borderColor: 'rgba(0,0,0,.2)',
  })
  const $title = app.create('uitext', {
    value: 'Leaderboard',
    fontSize: 24,
    fontWeight: 500,
    color: 'white',
    textAlign: 'center',
    margin: [0, 0, 20, 0],
  })
  // $ui.add($title)
  const $head = app.create('uiview', {
    flexDirection: 'row',
    alignItems: 'center',
    margin: [0, 0, 20, 0]
  })
  $ui.add($head)
  const $head1 = app.create('uitext', {
    value: 'RANK',
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    flexBasis: 120,
  })
  $head.add($head1)
  const $head2 = app.create('uitext', {
    value: 'PLAYER',
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    flexGrow: 1,
  })
  $head.add($head2)
  const $head3 = app.create('uitext', {
    value: 'KILLS',
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    flexBasis: 150,
    textAlign: 'right',
  })
  $head.add($head3)
  const $head4 = app.create('uitext', {
    value: 'DEATHS',
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    flexBasis: 150,
    textAlign: 'right',
  })
  $head.add($head4)
  const $rows = []
  for (let i = 0; i < 10; i ++) {
    const entry = rows[i]
    const $row = app.create('uiview', {
      flexDirection: 'row',
      alignItems: 'center',
      margin: [0, 0, 8, 0]
    })
    const $rank = app.create('uitext', {
      value: entry ? `#${i+1}` : '',
      color: i === 0 ? 'white' : 'rgba(255,255,255,0.5)',
      fontSize: 16,
      flexBasis: 120,
    })
    $row.add($rank)
    const $name = app.create('uitext', {
      value: entry ? entry.name.slice(0, 13) : '',
      color: i === 0 ? 'white' : 'rgba(255,255,255,0.5)',
      fontSize: 16,
      flexGrow: 1,
    })
    $row.add($name)
    const $kills = app.create('uitext', {
      value: entry ? entry.kills : '',
      color: i === 0 ? 'white' : 'rgba(255,255,255,0.5)',
      fontSize: 16,
      fontWeight: 100,
      textAlign: 'right',
      flexBasis: 150,
    })
    $row.add($kills)
    const $deaths = app.create('uitext', {
      value: entry ? entry.deaths : '',
      color: i === 0 ? 'white' : 'rgba(255,255,255,0.5)',
      fontSize: 16,
      fontWeight: 100,
      textAlign: 'right',
      flexBasis: 150,
    })
    $row.add($deaths)
    $ui.add($row)
    $rows.push({ $row, $rank, $name, $kills, $deaths })
  }
  return {
    node: $ui,
    change(idx, entry) {
      console.log('change', idx, entry)
      const $row = $rows[idx]
      $row.$rank.value = `#${idx+1}`
      $row.$name.value = entry.name.slice(0, 13)
      $row.$kills.value = entry.kills
      $row.$deaths.value = entry.deaths
    }
  }
}