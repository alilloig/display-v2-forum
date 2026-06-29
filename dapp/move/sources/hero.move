#[allow(lint(self_transfer))]
module display_showcase::hero;

use std::string::String;
use sui::display_registry::{Self, DisplayRegistry};
use sui::package::{Self, Publisher};

/// One-time witness — consumed in `init` to claim the Publisher.
public struct HERO has drop {}

/// A mintable NFT. Its struct fields never change on-chain; the Display template
/// alone controls the off-chain rendered representation (the "metadata view").
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
    transfer::public_transfer(package::claim(otw, ctx), ctx.sender());
}

/// Anyone can mint. The new object is transferred to the caller.
public fun mint(
    name: String,
    image_url: String,
    species: String,
    power: u64,
    level: u64,
    ctx: &mut TxContext,
) {
    transfer::public_transfer(Hero { id: object::new(ctx), name, image_url, species, power, level }, ctx.sender());
}

/// One-time setup: create an empty shared Display<Hero> and keep the cap.
/// Separate from `init` because DisplayRegistry is a shared object.
public fun create_display(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) {
    let (display, cap) = display_registry::new_with_publisher<Hero>(registry, publisher, ctx);
    display_registry::share(display);
    transfer::public_transfer(cap, ctx.sender());
}
