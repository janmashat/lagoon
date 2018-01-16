// @flow

import path from 'path';
import { green } from 'chalk';
import R from 'ramda';
import inquirer from 'inquirer';
import { createConfig } from '../util/config';
import { fileExists } from '../util/fs';
import { printErrors } from '../printErrors';

import typeof Yargs from 'yargs';
import type { BaseArgs } from '.';

const name = 'init';
const description =
  'Create a .lagoon.yml config file in the current working directory';

type GetOverwriteOptionArgs = {
  exists: boolean,
  filepath: string,
  overwriteOption: ?boolean,
};

const getOverwriteOption = async (
  args: GetOverwriteOptionArgs,
): Promise<boolean> =>
  R.cond([
    // If the file doesn't exist, the file doesn't need to be overwritten
    [R.propEq('exists', false), R.F],
    // If the overwrite option for the command has been specified, use the value of that
    [
      R.propSatisfies(
        // Option is not null or undefined
        R.complement(R.isNil),
        'overwriteOption',
      ),
      R.prop('overwriteOption'),
    ],
    // If none of the previous conditions have been satisfied, ask the user if they want to overwrite the file
    [
      R.T,
      async ({ filepath }) => {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `File '${filepath}' already exists! Overwrite?`,
            default: false,
          },
        ]);
        return overwrite;
      },
    ],
  ])(args);

export function setup(yargs: Yargs) {
  return yargs
    .usage(`$0 ${name} - ${description}`)
    .options({
      overwrite: {
        describe: 'Overwrite the configuration file if it exists',
        type: 'boolean',
        default: undefined,
      },
      project: {
        describe: 'Name of project to configure',
        type: 'string',
        alias: 's',
      },
    })
    .example(
      `$0 ${name}`,
      'Create a config file at ./.lagoon.yml. This will confirm with the user whether to overwrite the config if it already exists and also prompt for a project name to add to the config.\n',
    )
    .example(
      `$0 ${name} --overwrite`,
      'Overwrite existing config file (do not confirm with the user).\n',
    )
    .example(
      `$0 ${name} --overwrite false`,
      'Prevent overwriting of existing config file (do not confirm with user).\n',
    )
    .example(
      `$0 ${name} --project my_project`,
      'Set project to "my_project" (do not prompt the user).\n',
    )
    .example(
      `$0 ${name} -s my_project`,
      'Short form for setting project to "my_project" (do not prompt the user).\n',
    )
    .example(
      `$0 ${name} --overwrite --project my_project`,
      'Overwrite existing config files and set project to "my_project" (do not confirm with or prompt the user).',
    );
}

type Args = BaseArgs & {
  overwrite: ?boolean,
  project: ?string,
};

export async function run({
  cwd,
  overwrite: overwriteOption,
  project,
  clog,
  cerr,
}:
Args): Promise<number> {
  const filepath = path.join(cwd, '.lagoon.yml');

  const exists = await fileExists(filepath);

  const overwrite = await getOverwriteOption({
    exists,
    filepath,
    overwriteOption,
  });

  if (exists && !overwrite) {
    return printErrors(cerr, `Not overwriting existing file '${filepath}'.`);
  }

  const configInput = project
    ? { project }
    : await inquirer.prompt([
      {
        type: 'input',
        name: 'project',
        message: 'Enter the name of the project to configure.',
        validate: input =>
          input ? Boolean(input) : 'Please enter a project.',
      },
    ]);

  try {
    clog(`Creating file '${filepath}'...`);
    await createConfig(filepath, configInput);
    clog(green('Configuration file created!'));
  } catch (e) {
    return printErrors(cerr, `Error occurred while writing to ${filepath}:`, e);
  }

  return 0;
}

export default {
  setup,
  name,
  description,
  run,
};
