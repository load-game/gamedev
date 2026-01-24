#[dojo::contract]
mod arena {
    use starknet::ContractAddress;
    use core::traits::Into;
    use core::array::ArrayTrait;
    use dojo::world::IWorldDispatcher;

    // ===== MODELS =====

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct TournamentResult {
        #[key]
        match_id: felt252,
        winner: ContractAddress,
        participants: Array<ContractAddress>,
        timestamps: u64,
        season_id: u32,
        tournament_type: felt252, // 0=deathmatch, 1=team, 2=custom
        total_kills: u32,
        match_duration: u32,
    }

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct ChampionTitle {
        #[key]
        player: ContractAddress,
        title: felt252, // 0=Arena Novice, 1=Warrior, 2=Champion, 3=Legend
        title_name: ByteArray,
        earned_at: u64,
        tournaments_won: u32,
        total_score: u32,
        highest_kill_streak: u32,
    }

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct WeaponSkin {
        #[key]
        token_id: felt252,
        owner: ContractAddress,
        skin_type: felt252, // 0=fire, 1=ice, 2=legendary, 3=golden
        skin_name: ByteArray,
        tournament_won: felt252,
        earned_at: u64,
        rarity: u32, // 1=common, 2=rare, 3=epic, 4=legendary
        is_equipped: bool,
    }

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct PlayerStats {
        #[key]
        player: ContractAddress,
        total_matches: u32,
        total_wins: u32,
        total_kills: u32,
        total_deaths: u32,
        total_score: u32,
        best_kill_streak: u32,
        favorite_weapon: felt252,
        playtime_seconds: u64,
        last_active: u64,
    }

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct SeasonLeaderboard {
        #[key]
        season_id: u32,
        entries: Array<ContractAddress>,
        last_updated: u64,
        total_players: u32,
        top_score: u32,
    }

    // ===== INTERFACES =====

    #[dojo::interface]
    trait IArena {
        fn record_match_result(
            world: IWorldDispatcher,
            match_id: felt252,
            winner: ContractAddress,
            participants: Array<ContractAddress>,
            player_scores: Array<u32>,
            player_kills: Array<u32>,
            season_id: u32,
            tournament_type: felt252
        );

        fn award_champion_title(
            world: IWorldDispatcher,
            player: ContractAddress,
            title: felt252,
            title_name: ByteArray,
            tournament_won: felt252
        );

        fn mint_weapon_skin(
            world: IWorldDispatcher,
            owner: ContractAddress,
            skin_type: felt252,
            skin_name: ByteArray,
            tournament_won: felt252,
            rarity: u32
        ) -> felt252;

        fn update_player_stats(
            world: IWorldDispatcher,
            player: ContractAddress,
            kills: u32,
            deaths: u32,
            score: u32,
            match_duration: u32
        );

        fn get_player_title(player: ContractAddress) -> ChampionTitle;
        fn get_player_skins(player: ContractAddress) -> Array<WeaponSkin>;
        fn get_leaderboard(season_id: u32) -> Array<ContractAddress>;
    }

    // ===== IMPLEMENTATION =====

    #[dojo::contract]
    impl ArenaImpl of IArena {

        fn record_match_result(
            mut world: IWorldDispatcher,
            match_id: felt252,
            winner: ContractAddress,
            mut participants: Array<ContractAddress>,
            player_scores: Array<u32>,
            player_kills: Array<u32>,
            season_id: u32,
            tournament_type: felt252
        ) {
            // Calculate total kills for this match
            let mut total_kills = 0;
            let mut i = 0;
            while i < player_kills.len() {
                total_kills += player_kills[i];
                i += 1;
            };

            // Record tournament result
            let tournament_result = TournamentResult {
                match_id,
                winner,
                participants: participants.clone(),
                timestamps: starknet::get_block_timestamp(),
                season_id,
                tournament_type,
                total_kills,
                match_duration: 180, // Default 3 minutes, can be parameterized
            };

            world.set_entity(match_id, tournament_result);

            // Update stats for all participants
            let mut j = 0;
            while j < participants.len() {
                let player = participants[j];
                let kills = if j < player_kills.len() { player_kills[j] } else { 0 };
                let score = if j < player_scores.len() { player_scores[j] } else { 0 };

                update_single_player_stats(ref world, player, kills, 1, score, 180);

                // Award champion title to winner
                if player == winner {
                    award_champion_title_for_victory(ref world, player, season_id, match_id);
                }

                // Mint special skins for top performers
                if score >= 100 || kills >= 10 {
                    mint_performance_skin(ref world, player, match_id, score, kills);
                }

                j += 1;
            };

            // Update season leaderboard
            update_season_leaderboard(ref world, season_id, participants, player_scores);
        }

        fn award_champion_title(
            mut world: IWorldDispatcher,
            player: ContractAddress,
            title: felt252,
            title_name: ByteArray,
            tournament_won: felt252
        ) {
            let existing_title = get_player_title(player);

            let champion_title = ChampionTitle {
                player,
                title,
                title_name,
                earned_at: starknet::get_block_timestamp(),
                tournaments_won: existing_title.tournaments_won + 1,
                total_score: existing_title.total_score,
                highest_kill_streak: existing_title.highest_kill_streak,
            };

            world.set_entity(player, champion_title);
        }

        fn mint_weapon_skin(
            mut world: IWorldDispatcher,
            owner: ContractAddress,
            skin_type: felt252,
            skin_name: ByteArray,
            tournament_won: felt252,
            rarity: u32
        ) -> felt252 {
            // Generate unique token_id
            let unique_salt = starknet::get_contract_address();
            let token_id = unique_salt + starknet::get_block_timestamp() + tournament_won;

            let weapon_skin = WeaponSkin {
                token_id,
                owner,
                skin_type,
                skin_name,
                tournament_won,
                earned_at: starknet::get_block_timestamp(),
                rarity,
                is_equipped: false,
            };

            world.set_entity(token_id, weapon_skin);
            token_id
        }

        fn update_player_stats(
            mut world: IWorldDispatcher,
            player: ContractAddress,
            kills: u32,
            deaths: u32,
            score: u32,
            match_duration: u32
        ) {
            update_single_player_stats(ref world, player, kills, deaths, score, match_duration);
        }

        fn get_player_title(player: ContractAddress) -> ChampionTitle {
            // This would be implemented with actual world queries in practice
            // For now, return default title
            ChampionTitle {
                player,
                title: 0,
                title_name: "Arena Novice",
                earned_at: 0,
                tournaments_won: 0,
                total_score: 0,
                highest_kill_streak: 0,
            }
        }

        fn get_player_skins(player: ContractAddress) -> Array<WeaponSkin> {
            // Return empty array for now - would query world for player's skins
            Default::default()
        }

        fn get_leaderboard(season_id: u32) -> Array<ContractAddress> {
            // Return empty array for now - would query world for leaderboard
            Default::default()
        }
    }

    // ===== HELPER FUNCTIONS =====

    fn update_single_player_stats(
        mut world: IWorldDispatcher,
        player: ContractAddress,
        kills: u32,
        deaths: u32,
        score: u32,
        match_duration: u32
    ) {
        let mut existing_stats = get_default_player_stats(player);

        // In practice, you'd query the world for existing stats
        // For now, we'll just create/update with new values

        let updated_stats = PlayerStats {
            player,
            total_matches: existing_stats.total_matches + 1,
            total_wins: existing_stats.total_wins, // Updated separately
            total_kills: existing_stats.total_kills + kills,
            total_deaths: existing_stats.total_deaths + deaths,
            total_score: existing_stats.total_score + score,
            best_kill_streak: if kills > existing_stats.best_kill_streak { kills } else { existing_stats.best_kill_streak },
            favorite_weapon: existing_stats.favorite_weapon, // Would track weapon usage
            playtime_seconds: existing_stats.playtime_seconds + match_duration.into(),
            last_active: starknet::get_block_timestamp(),
        };

        world.set_entity(player, updated_stats);
    }

    fn award_champion_title_for_victory(
        mut world: IWorldDispatcher,
        player: ContractAddress,
        season_id: u32,
        match_id: felt252
    ) {
        let existing_title = get_player_title(player);
        let new_title_level = determine_title_level(existing_title.tournaments_won + 1);
        let title_name = get_title_name(new_title_level);

        let champion_title = ChampionTitle {
            player,
            title: new_title_level,
            title_name,
            earned_at: starknet::get_block_timestamp(),
            tournaments_won: existing_title.tournaments_won + 1,
            total_score: existing_title.total_score,
            highest_kill_streak: existing_stats.highest_kill_streak,
        };

        world.set_entity(player, champion_title);
    }

    fn mint_performance_skin(
        mut world: IWorldDispatcher,
        player: ContractAddress,
        match_id: felt252,
        score: u32,
        kills: u32
    ) {
        let (skin_type, skin_name, rarity) = determine_performance_rewards(score, kills);
        let unique_salt = starknet::get_contract_address();
        let token_id = unique_salt + starknet::get_block_timestamp() + match_id;

        let weapon_skin = WeaponSkin {
            token_id,
            owner: player,
            skin_type,
            skin_name,
            tournament_won: match_id,
            earned_at: starknet::get_block_timestamp(),
            rarity,
            is_equipped: false,
        };

        world.set_entity(token_id, weapon_skin);
    }

    fn update_season_leaderboard(
        mut world: IWorldDispatcher,
        season_id: u32,
        participants: Array<ContractAddress>,
        player_scores: Array<u32>
    ) {
        // In practice, this would update a more complex leaderboard data structure
        let leaderboard = SeasonLeaderboard {
            season_id,
            entries: participants,
            last_updated: starknet::get_block_timestamp(),
            total_players: participants.len(),
            top_score: get_max_score(player_scores),
        };

        world.set_entity(season_id.into(), leaderboard);
    }

    // ===== UTILITY FUNCTIONS =====

    fn get_default_player_stats(player: ContractAddress) -> PlayerStats {
        PlayerStats {
            player,
            total_matches: 0,
            total_wins: 0,
            total_kills: 0,
            total_deaths: 0,
            total_score: 0,
            best_kill_streak: 0,
            favorite_weapon: 0,
            playtime_seconds: 0,
            last_active: 0,
        }
    }

    fn determine_title_level(tournaments_won: u32) -> felt252 {
        if tournaments_won >= 50 {
            3 // Legend
        } else if tournaments_won >= 20 {
            2 // Champion
        } else if tournaments_won >= 5 {
            1 // Warrior
        } else {
            0 // Novice
        }
    }

    fn get_title_name(title_level: felt252) -> ByteArray {
        if title_level == 3 {
            "Arena Legend"
        } else if title_level == 2 {
            "Arena Champion"
        } else if title_level == 1 {
            "Arena Warrior"
        } else {
            "Arena Novice"
        }
    }

    fn determine_performance_rewards(score: u32, kills: u32) -> (felt252, ByteArray, u32) {
        if score >= 200 || kills >= 20 {
            (3, "Legendary Champion", 4) // Legendary
        } else if score >= 150 || kills >= 15 {
            (2, "Elite Warrior", 3) // Epic
        } else if score >= 100 || kills >= 10 {
            (1, "Skilled Fighter", 2) // Rare
        } else {
            (0, "Combatant", 1) // Common
        }
    }

    fn get_max_score(scores: Array<u32>) -> u32 {
        let mut max_score = 0;
        let mut i = 0;
        while i < scores.len() {
            if scores[i] > max_score {
                max_score = scores[i];
            }
            i += 1;
        };
        max_score
    }
}