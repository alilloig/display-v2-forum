// `mint` hands the new Hero to the caller and `create_display` hands the
// DisplayCap to the deployer — both transfer-to-sender on purpose, so we opt
// out of the self_transfer composability lint to keep the build warning-free.
#[allow(lint(self_transfer))]
module display_showcase::hero;

use std::string::String;
use sui::display_registry::{Self, DisplayRegistry};
use sui::package::{Self, Publisher};

/// One-time witness — consumed in `init` to claim the Publisher.
public struct HERO has drop {}

/// A mintable NFT. All fields are set at mint time and never changed on-chain;
/// the Display template controls the off-chain rendered representation.
public struct Hero has key, store {
    id: UID,
    name: String,
    image_url: String,
    species: String,
    power: u64,
    level: u64,
}

/// Claim Publisher on deploy; transfer to the deployer for use in `create_display`.
fun init(otw: HERO, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    transfer::public_transfer(publisher, ctx.sender());
}

/// Anyone can mint a Hero. The new object is transferred to the caller.
public fun mint(
    name: String,
    image_url: String,
    species: String,
    power: u64,
    level: u64,
    ctx: &mut TxContext,
) {
    let hero = Hero { id: object::new(ctx), name, image_url, species, power, level };
    transfer::public_transfer(hero, ctx.sender());
}

/// One-time setup: create an empty shared Display<Hero> and keep the cap.
/// Must be a separate entry because DisplayRegistry is a shared object and
/// cannot be received in `init`.
public fun create_display(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) {
    let (display, cap) = display_registry::new_with_publisher<Hero>(registry, publisher, ctx);
    display_registry::share(display);
    transfer::public_transfer(cap, ctx.sender());
}

// ── Test-only accessors ──────────────────────────────────────────────────────

#[test_only]
public fun name(hero: &Hero): String { hero.name }

#[test_only]
public fun image_url(hero: &Hero): String { hero.image_url }

#[test_only]
public fun species(hero: &Hero): String { hero.species }

#[test_only]
public fun power(hero: &Hero): u64 { hero.power }

#[test_only]
public fun level(hero: &Hero): u64 { hero.level }
