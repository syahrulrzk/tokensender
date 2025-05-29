import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import readline from "readline";
import chalk from "chalk";
import cliProgress from "cli-progress";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const tokenContract = new ethers.Contract(
    process.env.TOKEN_ADDRESS,
    [
      "function transfer(address to, uint amount) public returns (bool)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function balanceOf(address account) view returns (uint)",
    ],
    wallet
  );

  const filePath = "addres.txt";
  const amountInput = await question(chalk.cyan("Masukkan jumlah ZEN yang ingin dikirim per alamat: "));
  const loopCount = parseInt(await question(chalk.cyan("Berapa kali ingin diulang? (loop count): ")));
  rl.close();

  const addresses = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  const amount = ethers.parseUnits(amountInput, decimals);
  const balance = await tokenContract.balanceOf(wallet.address);
  const totalToSend = amount * BigInt(addresses.length) * BigInt(loopCount);

  console.log(chalk.green("================================================================================"));
  console.log(chalk.green("=============================== Informasi Token ================================"));
  console.log(chalk.green("================================================================================"));
  console.log(chalk.yellow(`\nSaldo token kamu: ${ethers.formatUnits(balance, decimals)} ${symbol}`));
  console.log(chalk.yellow(`Total token yang akan dikirim: ${ethers.formatUnits(totalToSend, decimals)} ${symbol}`));

  console.log(chalk.green("=".repeat(80))); // ✅ Tambahan baris pemisah hijau
  if (balance < totalToSend) {
    console.error(chalk.red("\n❌ Saldo tidak cukup."));
    process.exit(1);
  }

  let txCounter = 1;
  let nonce = await provider.getTransactionCount(wallet.address);

  for (let i = 0; i < loopCount; i++) {
    console.log(chalk.magentaBright(`\n[Putaran ${i + 1}/${loopCount}]`));

    for (const to of addresses) {
      try {
        console.log(chalk.blue(`Transaksi #${txCounter} | Nonce: ${nonce}`));
        console.log(chalk.blue(`Mengirim ${ethers.formatUnits(amount, decimals)} ${symbol} ke ${to}...`));

        const tx = await tokenContract.transfer(to, amount, { nonce });
        console.log(chalk.green(`Tx hash: ${tx.hash}`));

        // PROGRESS BAR
        const bar = new cliProgress.SingleBar({
          format: chalk.cyan('⏳ Menunggu konfirmasi transaksi... [{bar}] {percentage}% | {duration_formatted}'),
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true,
        }, cliProgress.Presets.shades_classic);

        bar.start(100, 0);

        for (let j = 0; j <= 100; j++) {
          bar.update(j);
          await delay(20); // progress visual (2 sec total)
        }

        bar.stop();

        await tx.wait();
        console.log(chalk.green("✅ Transaksi sukses!"));

        nonce++;
        txCounter++;

        // JEDA 30 DETIK
        console.log(chalk.gray("🕒 Menunggu 20 detik sebelum transaksi berikutnya...\n"));
        await delay(20000);
        console.log(chalk.green("=".repeat(80))); // ✅ Tambahan baris pemisah hijau

      } catch (err) {
        console.error(chalk.red(`❌ Gagal kirim token ke ${to}: ${err.message}`));
      }
    }
  }
}

main().catch((err) => {
  console.error(chalk.red("Terjadi kesalahan:"), err);
  process.exit(1);
});
