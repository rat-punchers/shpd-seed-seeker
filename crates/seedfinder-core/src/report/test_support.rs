//! Report builders and oracle-fixture samples the report tests share.

use std::fmt;

use serde_json::Value;

use super::{SeedReport, decode_request};
use crate::catalog::{ItemId, item_by_stable_id};
use crate::challenges::Challenges;
use crate::level_map::{LevelMap, generate_level_map};
use crate::seed::DungeonSeed;

/// The report a request JSON asks for.
pub(super) fn report(request: &str) -> SeedReport {
    decode_request(request).unwrap().generate().unwrap()
}

/// The plain report of a seed code or daily date.
pub(super) fn seed_report(seed: &str) -> SeedReport {
    report(&format!(r#"{{"seed":"{seed}"}}"#))
}

/// One generated run: a seed, a challenge mask and the selected trinket.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Run<'a> {
    pub seed: &'a str,
    pub challenges: u16,
    pub trinket: Option<ItemId>,
}

impl<'a> Run<'a> {
    pub const fn new(seed: &'a str, challenges: u16, trinket: Option<ItemId>) -> Self {
        Self {
            seed,
            challenges,
            trinket,
        }
    }

    /// The run an oracle fixture sample names in `seed`, `challenges` and
    /// `trinket`.
    pub fn of_sample(sample: &'a Value) -> Self {
        Self {
            seed: sample["seed"].as_str().unwrap(),
            challenges: u16::try_from(sample["challenges"].as_u64().unwrap()).unwrap(),
            trinket: sample["trinket"]
                .as_str()
                .map(|id| item_by_stable_id(id).unwrap().id),
        }
    }

    pub fn challenge_mask(self) -> Challenges {
        Challenges::new(self.challenges).unwrap()
    }

    pub fn report(self) -> SeedReport {
        let mut request = decode_request(&format!(r#"{{"seed":"{}"}}"#, self.seed)).unwrap();
        request.challenges = self.challenge_mask();
        request.selected_trinket = self.trinket;
        request.generate().unwrap()
    }

    /// The regular map of `depth` in the run `report` describes.
    pub fn level_map(self, report: &SeedReport, depth: u8) -> LevelMap {
        let seed = DungeonSeed::new(report.seed.value).unwrap();
        generate_level_map(seed, depth, self.challenge_mask(), self.trinket).unwrap()
    }
}

impl fmt::Display for Run<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self {
            seed,
            challenges,
            trinket,
        } = self;
        write!(f, "{seed} challenges {challenges} {trinket:?}")
    }
}

/// An oracle fixture's samples.
pub(super) fn samples(fixture: &Value) -> &[Value] {
    fixture["samples"].as_array().unwrap()
}

/// The distinct runs of several lists, in first-seen order, each with the
/// entry every list holds for it, so each run is generated only once.
pub(super) fn distinct_runs<'a, T, const N: usize>(
    lists: [&'a [T]; N],
    run_of: impl Fn(&'a T) -> Run<'a>,
) -> Vec<(Run<'a>, [Option<&'a T>; N])> {
    let mut output: Vec<(Run<'a>, [Option<&'a T>; N])> = Vec::new();
    for (list, entries) in lists.iter().enumerate() {
        for entry in *entries {
            let run = run_of(entry);
            let position = output.iter().position(|(seen, _)| *seen == run);
            let position = position.unwrap_or_else(|| {
                output.push((run, [None; N]));
                output.len() - 1
            });
            output[position].1[list] = Some(entry);
        }
    }
    output
}
