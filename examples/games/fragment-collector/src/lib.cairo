#[dojo::contract]
mod FragmentCollector {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    
    // Constants
    const TOTAL_FRAGMENTS: u32 = 10;
    
    // Models
    #[dojo::model]
    #[derive(Drop, Serde)]
    struct Player {
        #[key]
        address: ContractAddress,
        fragments_collected: u32,
        completion_time: u64,
        nft_deployed: bool,
    }
    
    #[dojo::model]
    #[derive(Drop, Serde)]
    struct Fragment {
        #[key]
        fragment_id: felt252,
        position_x: u32,
        position_y: u32,
        position_z: u32,
        collected: bool,
        collected_by: ContractAddress,
    }
    
    // Events
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        FragmentCollected: FragmentCollected,
        AllFragmentsCollected: AllFragmentsCollected,
        CompletionNFTDeployed: CompletionNFTDeployed,
    }
    
    #[derive(Drop, starknet::Event)]
    struct FragmentCollected {
        player: ContractAddress,
        fragment_id: felt252,
        total_collected: u32,
    }
    
    #[derive(Drop, starknet::Event)]
    struct AllFragmentsCollected {
        player: ContractAddress,
        completion_time: u64,
    }
    
    #[derive(Drop, starknet::Event)]
    struct CompletionNFTDeployed {
        player: ContractAddress,
        token_id: felt252,
    }
    
    // Systems
    #[external(v0)]
    fn collect_fragment(
        world: IWorldDispatcher,
        player_address: ContractAddress,
        fragment_id: felt252,
    ) {
        let mut player = world.entity_model_builder::<Player>(player_address);
        let mut fragment = world.entity_model_builder::<Fragment>(fragment_id);
        
        // Verify fragment not already collected
        assert(fragment.collected == false, 'Fragment already collected');
        
        // Update player
        player.fragments_collected += 1;
        
        // Update fragment
        fragment.collected = true;
        fragment.collected_by = player_address;
        
        // Emit collection event
        world.emit_event(
            Event::FragmentCollected(
                FragmentCollected {
                    player: player_address,
                    fragment_id,
                    total_collected: player.fragments_collected,
                }
            )
        );
        
        // Check if all fragments collected
        if (player.fragments_collected >= TOTAL_FRAGMENTS) {
            player.completion_time = get_block_timestamp();
            
            // Emit completion event
            world.emit_event(
                Event::AllFragmentsCollected(
                    AllFragmentsCollected {
                        player: player_address,
                        completion_time: player.completion_time,
                    }
                )
            );
        }
    }
    
    #[external(v0)]
    fn deploy_completion_nft(
        world: IWorldDispatcher,
        player_address: ContractAddress,
    ) -> felt252 {
        let mut player = world.entity_model_builder::<Player>(player_address);
        
        // Verify player completed collection
        assert(player.fragments_collected >= TOTAL_FRAGMENTS, 'Not enough fragments');
        assert(player.nft_deployed == false, 'NFT already deployed');
        
        // Generate unique token ID
        let token_id = starknet::info::get_contract_address().into() + world.random();
        
        // Mark as deployed
        player.nft_deployed = true;
        
        // Emit deployment event
        world.emit_event(
            Event::CompletionNFTDeployed(
                CompletionNFTDeployed {
                    player: player_address,
                    token_id,
                }
            )
        );
        
        token_id
    }
    
    // Read-only functions
    #[external(v0)]
    fn get_player_stats(
        world: IWorldDispatcher,
        player_address: ContractAddress,
    ) -> (u32, u64, bool) {
        let player = world.entity_model_builder::<Player>(player_address);
        (player.fragments_collected, player.completion_time, player.nft_deployed)
    }
    
    #[external(v0)]
    fn get_fragment_status(
        world: IWorldDispatcher,
        fragment_id: felt252,
    ) -> (bool, ContractAddress) {
        let fragment = world.entity_model_builder::<Fragment>(fragment_id);
        (fragment.collected, fragment.collected_by)
    }
}
