#[test_only]
module display_showcase::hero_tests;

use std::string::String;
use sui::test_scenario::{Self as ts};
use display_showcase::hero::{Self, Hero};

const USER: address = @0xA11CE;

// u64::MAX, used to pin that the level field is stored without truncation.
const U64_MAX: u64 = 18446744073709551615;

/// T-001 — a typical mint stores all five fields exactly as supplied.
///
/// `hero::mint` calls `transfer::public_transfer(hero, ctx.sender())`, so the
/// Hero lands in the sender's inventory; we take it out in a second tx and read
/// each field through the `#[test_only]` accessors the implementer must provide.
#[test]
fun mint_sets_all_fields_for_typical_hero() {
    let name: String = b"Aragon".to_string();
    let image_url: String = b"https://img.example/aragon.png".to_string();
    let species: String = b"Dragon".to_string();
    let power: u64 = 42;
    let level: u64 = 7;

    let mut scenario = ts::begin(USER);
    {
        hero::mint(name, image_url, species, power, level, scenario.ctx());
    };

    scenario.next_tx(USER);
    {
        let h = scenario.take_from_sender<Hero>();
        assert!(hero::name(&h) == name, 0);
        assert!(hero::image_url(&h) == image_url, 1);
        assert!(hero::species(&h) == species, 2);
        assert!(hero::power(&h) == power, 3);
        assert!(hero::level(&h) == level, 4);
        scenario.return_to_sender(h);
    };

    scenario.end();
}

/// T-002 — u64 boundary values (0 and u64::MAX) round-trip unchanged, and the
/// distinct String fields are preserved alongside them.
#[test]
fun mint_pins_u64_boundary_fields() {
    let name: String = b"Boundary".to_string();
    let image_url: String = b"https://img.example/boundary.png".to_string();
    let species: String = b"Phoenix".to_string();
    let power: u64 = 0;
    let level: u64 = U64_MAX;

    let mut scenario = ts::begin(USER);
    {
        hero::mint(name, image_url, species, power, level, scenario.ctx());
    };

    scenario.next_tx(USER);
    {
        let h = scenario.take_from_sender<Hero>();
        assert!(hero::power(&h) == 0, 0);
        assert!(hero::level(&h) == U64_MAX, 1);
        assert!(hero::name(&h) == name, 2);
        assert!(hero::image_url(&h) == image_url, 3);
        assert!(hero::species(&h) == species, 4);
        scenario.return_to_sender(h);
    };

    scenario.end();
}

/// T-003 — the three String fields are stored positionally correctly: each
/// accessor returns its own input, guarding against a name/image_url/species
/// constructor mix-up.
#[test]
fun mint_does_not_swap_string_fields() {
    let name: String = b"NAME_FIELD".to_string();
    let image_url: String = b"IMAGE_URL_FIELD".to_string();
    let species: String = b"SPECIES_FIELD".to_string();
    let power: u64 = 100;
    let level: u64 = 3;

    let mut scenario = ts::begin(USER);
    {
        hero::mint(name, image_url, species, power, level, scenario.ctx());
    };

    scenario.next_tx(USER);
    {
        let h = scenario.take_from_sender<Hero>();
        assert!(hero::name(&h) == name, 0);
        assert!(hero::image_url(&h) == image_url, 1);
        assert!(hero::species(&h) == species, 2);
        // Cross-checks: no field accidentally aliases another.
        assert!(hero::name(&h) != hero::image_url(&h), 3);
        assert!(hero::name(&h) != hero::species(&h), 4);
        assert!(hero::image_url(&h) != hero::species(&h), 5);
        scenario.return_to_sender(h);
    };

    scenario.end();
}
